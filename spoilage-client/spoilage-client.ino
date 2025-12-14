#include <LiquidCrystal.h>
#include <Modulino.h>
#include <WiFiS3.h>
#include <WiFiSSLClient.h>

#include <ArduinoJson.h>
#include <StreamUtils.h>

#include "arduino_secrets.h"

char ssid[] = SECRET_SSID;
char pass[] = SECRET_PASS;
char server[] = "app.spoilage.xyz";
const int serverPort = 443;
const int MAX_CONNECTION_TRIES = 3;
const int MAX_ITEM_COUNT = 32;
const int LCD_WIDTH = 20;
const float ACCEL_WAKE_THRESHOLD = 0.02;
const int ACCEL_CONSEC_CHECKS = 2;
const int SCREEN_TIMEOUT = 40000;

typedef struct Item{
  int Id;
  String Name;
  int DaysLeft;
};
struct Item itemsList[MAX_ITEM_COUNT] = {};

int wifiStatus = WL_IDLE_STATUS;
const int rs = 12, en = 11, d4 = 5, d5 = 4, d6 = 3, d7 = 2;

LiquidCrystal lcd(rs, en, d4, d5, d6, d7);
ModulinoButtons buttons;
ModulinoMovement movement;
float xAccelRef = 0.0, yAccelRef = 0.0, zAccelRef = 0.0;
// float roll, pitch, yaw;
WiFiSSLClient client;

bool screenActive = false;
bool contextMenuOpen = false;
bool postponeMenuOpen = false;
int timeToSleep = 0;
int passedAccelChecks = 0;
int selectedItemIndex = 0;

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    ;
  }

  Modulino.begin();
  movement.begin();
  buttons.begin();

  pinMode(7, OUTPUT);
  pinMode(10, OUTPUT);
  pinMode(13, OUTPUT);
  digitalWrite(7, LOW);
  digitalWrite(10, HIGH);
  digitalWrite(13, LOW);
  delay(250);
  analogWrite(6, 104); // LCD contrast
  lcd.begin(20, 4);
  lcd.print("------SPOILAGE------");
  lcd.setCursor(0, 1);
  lcd.print("Arduino Client");
  lcd.setCursor(0, 2);
  lcd.print("Network: ");
  lcd.setCursor(9, 2);
  lcd.print(ssid);
  lcd.setCursor(0, 3);
  lcd.print("Connecting to Wi-Fi");

  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(8, OUTPUT);
  digitalWrite(8, HIGH);

  Serial.print("Attempting to connect to SSID: ");
  Serial.println(ssid);
  wifiStatus = WiFi.begin(ssid, pass);
  delay(10000);
  if (wifiStatus != WL_CONNECTED) {
    Serial.println("ERROR: Could not connect to WiFi network");
    restartFromError();
  }
}

void loop() {
  float xAccel, yAccel, zAccel;
  JsonDocument doc;

  movement.update();
  xAccel = movement.getX();
  yAccel = movement.getY();
  zAccel = movement.getZ();
  bool buttonStateChanged = buttons.update();
  if (!screenActive) {
    if (abs(xAccel - xAccelRef) > ACCEL_WAKE_THRESHOLD || abs(yAccel - yAccelRef) > ACCEL_WAKE_THRESHOLD || abs(zAccel - zAccelRef) > ACCEL_WAKE_THRESHOLD) {
      passedAccelChecks++;
    } else {
      passedAccelChecks = 0;
    }
    if (passedAccelChecks >= ACCEL_CONSEC_CHECKS || buttonStateChanged) {
      buttons.setLeds(true, true, true);
      digitalWrite(8, HIGH);
      lcd.display();
      screenActive = true;
      timeToSleep = millis() + SCREEN_TIMEOUT;
      passedAccelChecks = 0;
      
      refreshSummary(doc);
    }
  } else { // Screen is ON
    if (abs(xAccel - xAccelRef) > ACCEL_WAKE_THRESHOLD || abs(yAccel - yAccelRef) > ACCEL_WAKE_THRESHOLD || abs(zAccel - zAccelRef) > ACCEL_WAKE_THRESHOLD) {
      passedAccelChecks++;
    } else {
      passedAccelChecks = 0;
    }
    if (passedAccelChecks >= ACCEL_CONSEC_CHECKS || buttonStateChanged) {
      timeToSleep = millis() + SCREEN_TIMEOUT;
      xAccelRef = xAccel;
      yAccelRef = yAccel;
      zAccelRef = zAccel;
      Serial.print("Setting reference acceleration: (");
      Serial.print(String(xAccelRef));
      Serial.print(", ");
      Serial.print(String(yAccelRef));
      Serial.print(", ");
      Serial.print(String(zAccelRef));
      Serial.println(")");
      passedAccelChecks = 0;
    }
    if (buttonStateChanged) {
      if (contextMenuOpen) {
        if (postponeMenuOpen) {
          if (buttons.isPressed('A')) {
            String requestBody = String("{\"item_id\":\"");
            requestBody.concat(itemsList[selectedItemIndex].Id);
            requestBody.concat("\",\"postpone_by_days\":3}");
            apiRequest("PUT /api/item", requestBody.c_str(), doc);

            displayScreenForItem(selectedItemIndex, "");
            postponeMenuOpen = false;
            contextMenuOpen = false;
            refreshSummary(doc);
          } else if (buttons.isPressed('B')) {
            String requestBody = String("{\"item_id\":\"");
            requestBody.concat(itemsList[selectedItemIndex].Id);
            requestBody.concat("\",\"postpone_by_days\":7}");
            apiRequest("PUT /api/item", requestBody.c_str(), doc);

            displayScreenForItem(selectedItemIndex, "");
            postponeMenuOpen = false;
            contextMenuOpen = false;
            refreshSummary(doc);
          } else if (buttons.isPressed('C')) {
            String requestBody = String("{\"item_id\":\"");
            requestBody.concat(itemsList[selectedItemIndex].Id);
            requestBody.concat("\",\"postpone_by_days\":28}");
            apiRequest("PUT /api/item", requestBody.c_str(), doc);

            displayScreenForItem(selectedItemIndex, "");
            postponeMenuOpen = false;
            contextMenuOpen = false;
            refreshSummary(doc);
          }
        } else {
          if (buttons.isPressed('A')) {
            contextMenuOpen = false;
            displayScreenForItem(selectedItemIndex, "");
          } else if (buttons.isPressed('B')) {
            String requestBody = String("{\"item_id\":\"");
            requestBody.concat(itemsList[selectedItemIndex].Id);
            requestBody.concat("\"}");
            apiRequest("DELETE /api/item", requestBody.c_str(), doc);

            contextMenuOpen = false;
            refreshSummary(doc);
          } else if (buttons.isPressed('C')) {
            postponeMenuOpen = true;
            displayScreenForItem(selectedItemIndex, " 3d 7d 28d ");
          }
        }
      } else {
        if (buttons.isPressed('A') && selectedItemIndex > 0) {
          selectedItemIndex--;
          displayScreenForItem(selectedItemIndex, "");
        } else if (buttons.isPressed('B') && itemsList[selectedItemIndex + 1].Id != 0) {
          selectedItemIndex++;
          displayScreenForItem(selectedItemIndex, "");
        } else if (buttons.isPressed('C')) {
          contextMenuOpen = true;
          displayScreenForItem(selectedItemIndex, " BACK DELETE SNOOZE ");
        }
      }
    }
    if (millis() > timeToSleep) {
      buttons.setLeds(false, false, false);
      digitalWrite(8, LOW);
      lcd.noDisplay();
      postponeMenuOpen = false;
      contextMenuOpen = false;
      screenActive = false;

      xAccelRef = xAccel;
      yAccelRef = yAccel;
      zAccelRef = zAccel;
      Serial.print("Setting reference acceleration: (");
      Serial.print(String(xAccelRef));
      Serial.print(", ");
      Serial.print(String(yAccelRef));
      Serial.print(", ");
      Serial.print(String(zAccelRef));
      Serial.println(")");
      passedAccelChecks = 0;
    }
  }
  delay(100);
}

void displayScreenForItem(int index, char buttonHelpText[]) {
  lcd.clear();
  int startIndex = (index / 4) * 4;
  for (int i = startIndex; i < startIndex + 4; i++) {
    if (itemsList[i].Id == 0) {
      break;
    }
    int screenIndex = i % 4;
    if (i == index) {
      lcd.setCursor(0, screenIndex);
      lcd.print('>');
    }
    
    lcd.setCursor(1, screenIndex);
    lcd.write(itemsList[i].Name.c_str());
    String daysLeftString = String(itemsList[i].DaysLeft);
    lcd.setCursor(19-daysLeftString.length()-1, screenIndex);
    lcd.print(' ');
    lcd.setCursor(19-daysLeftString.length(), screenIndex);
    lcd.write(daysLeftString.c_str());
    lcd.setCursor(19, screenIndex);
    lcd.print('d');
  }

  String buttonHelpTextObj = String(buttonHelpText);
  int buttonHelpLength = buttonHelpTextObj.length();
  if (buttonHelpLength > 0) {
    int startX = (LCD_WIDTH - buttonHelpLength) / 2;
    lcd.setCursor(startX, 3);
    lcd.write(buttonHelpText);
  }
}

void refreshSummary(JsonDocument &doc) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.write("Fetching dates...");
  apiRequest("GET /api/summary", "", doc);
  JsonArray items = doc["items"];

  // Get trash day warning flag in the response
  int itemIndex = 0;
  for (JsonVariant item : items) {
    itemsList[itemIndex].Id = item["item_id"];
    itemsList[itemIndex].Name = String(item["item_name"]);
    itemsList[itemIndex].DaysLeft = item["days_till_expiration"];

    if (++itemIndex >= MAX_ITEM_COUNT) {
      Serial.println("Received more item entries than could fit.");
      break;
    }
  }
  // Overwrite the Id of any remaining entries in the array
  for (int i = itemIndex; i < MAX_ITEM_COUNT; i++) {
    itemsList[itemIndex].Id = 0;
  }

  String message = String(doc["arduino_message"]);
  
  if (message.length() > 0) {
    lcd.clear();
    int lastNewLineIndex = 0;
    int lcdLine = 0;
    while (lastNewLineIndex < message.length()) {
      lcd.setCursor(0, lcdLine);
      int newLineIndex = message.indexOf('\n', lastNewLineIndex);
      if (newLineIndex == -1) {
        lcd.write((message.substring(lastNewLineIndex)).c_str());
        break;
      } else {
        lcd.write((message.substring(lastNewLineIndex, newLineIndex)).c_str());
      }
      lastNewLineIndex = newLineIndex + 1;
      lcdLine++;
    }
    delay(5000);
  }
  
  selectedItemIndex = 0;
  displayScreenForItem(selectedItemIndex, "");
}

void apiRequest(const char endpoint[], const char body[], JsonDocument &doc) {
  buttons.setLeds(false, false, false);
  while (client.connected()) {
    Serial.println("Waiting for previous connection to close");
    digitalWrite(LED_BUILTIN, HIGH);
    delay(100);
    digitalWrite(LED_BUILTIN, LOW);
    delay(500);
  }
  int connectionTries = 0;
  while (connectionTries < MAX_CONNECTION_TRIES) {
    if (client.connect(server, serverPort)) {
      client.print(endpoint); client.println(" HTTP/1.1");
      client.println("Host: app.spoilage.xyz");
      client.print("Authorization: Basic "); client.println(SECRET_AUTH);
      int bodyLength = String(body).length();
      if (bodyLength > 0) {
        client.println("Content-Type: application/json");
        String contentLengthHeader = String("Content-Length: ");
        contentLengthHeader.concat(bodyLength);
        client.println(contentLengthHeader.c_str());
      }
      client.println("Connection: close");
      client.println();
      client.println(body);
      client.println();
      Serial.println("connection made");
      break;
    } else {
      client.stop();
      connectionTries++;
    }
  }

  if (connectionTries == MAX_CONNECTION_TRIES) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("ERR: Couldn't reach");
    lcd.setCursor(0, 1);
    lcd.print("Spoilage server.");
    lcd.setCursor(0, 2);
    lcd.print("Check server, then");
    lcd.setCursor(0, 3);
    lcd.print("press RESET");
    for (;;) {}
  }

  char endOfHeaders[] = "\r\n\r\n";
  if (!client.find(endOfHeaders)) {
    Serial.println("Invalid response; no body found");
    client.stop();
    restartFromError();
  }

  ReadLoggingStream loggingStream(client, Serial);
  DeserializationError error = deserializeJson(doc, loggingStream);
  if (error) {
    Serial.println("ERROR: Could not deserialize response from budgeting.robel.dev");
    Serial.println(error.c_str());
    restartFromError();
  }

  client.stop();
  buttons.setLeds(true, true, true);
}

void restartFromError() {
  screenActive = false;
  contextMenuOpen = false;
  postponeMenuOpen = false;
  timeToSleep = 0;
  passedAccelChecks = 0;
  selectedItemIndex = 0;
  xAccelRef = 0.0, yAccelRef = 0.0, zAccelRef = 0.0;
  setup();
}
