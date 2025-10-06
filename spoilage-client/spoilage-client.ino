#include <LiquidCrystal.h>
#include <Modulino.h>
#include <WiFiS3.h>
#include <WiFiSSLClient.h>

#include <ArduinoJson.h>

#include "arduino_secrets.h"

char ssid[] = SECRET_SSID;
char pass[] = SECRET_PASS;
char server[] = "budgeting.robel.dev";
const int serverPort = 8443;
const int MAX_ITEM_COUNT = 32;
const float ACCEL_WAKE_THRESHOLD = 0.2;
const int SCREEN_TIMEOUT = 60000;

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
int timeToSleep = 0;

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    ;
  }

  Modulino.begin();
  movement.begin();
  buttons.begin();

  lcd.begin(20, 4);
  lcd.print("SPOILAGE v0.1.0");
  lcd.setCursor(0, 1);
  lcd.print("Network: ");
  lcd.setCursor(9, 1);
  lcd.print(ssid);
  lcd.setCursor(0, 2);
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
    haltAsError();
  }
}

void loop() {
  float xAccel, yAccel, zAccel;
  JsonDocument doc;

  movement.update();
  xAccel = movement.getX();
  yAccel = movement.getY();
  zAccel = movement.getZ();
  if (!screenActive) {
    if (abs(xAccel - xAccelRef) > ACCEL_WAKE_THRESHOLD || abs(yAccel - yAccelRef) > ACCEL_WAKE_THRESHOLD || abs(zAccel - zAccelRef) > ACCEL_WAKE_THRESHOLD || buttons.update()) {
      buttons.setLeds(true, true, true);
      digitalWrite(8, HIGH);
      lcd.display();
      screenActive = true;
      timeToSleep = millis() + SCREEN_TIMEOUT;
      
      apiRequest("GET /api/summary", "", doc);
      JsonArray items = doc["items"];

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

      lcd.clear();
      for (int i = 0; i < 4; i++) {
        if (itemsList[i].Id == 0) {
          break;
        }
        lcd.setCursor(0, i);
        lcd.write(itemsList[i].Name.c_str());
        String daysLeftString = String(itemsList[i].DaysLeft);
        lcd.setCursor(19-daysLeftString.length()-1, i);
        lcd.write(" ");
        lcd.setCursor(19-daysLeftString.length(), i);
        lcd.write(daysLeftString.c_str());
        lcd.setCursor(19, i);
        lcd.write("d");
      }
    }
  } else { // Screen is ON
    if (abs(xAccel - xAccelRef) > ACCEL_WAKE_THRESHOLD || abs(yAccel - yAccelRef) > ACCEL_WAKE_THRESHOLD || abs(zAccel - zAccelRef) > ACCEL_WAKE_THRESHOLD || buttons.update()) {
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
    }
    if (millis() > timeToSleep) {
      buttons.setLeds(false, false, false);
      digitalWrite(8, LOW);
      lcd.noDisplay();
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
    }
  }
  delay(200);
}

void apiRequest(char endpoint[], char body[], JsonDocument &doc) {
  while (client.connected()) {
    Serial.println("Waiting for previous connection to close");
    digitalWrite(LED_BUILTIN, HIGH);
    delay(100);
    digitalWrite(LED_BUILTIN, LOW);
    delay(500);
  }
  if (client.connect(server, serverPort)) {
    client.print(endpoint); client.println(" HTTP/1.1");
    client.println("Host: budgeting.robel.dev");
    client.print("Authorization: Basic "); client.println(SECRET_AUTH);
    client.println("Connection: close");
    client.println();
    client.println(body);
  } else {
    Serial.println("ERROR: Could not connect to budgeting.robel.dev");
    haltAsError();
  }

  char endOfHeaders[] = "\r\n\r\n";
  if (!client.find(endOfHeaders)) {
    Serial.println("Invalid response; no body found");
    client.stop();
    haltAsError();
  }
  DeserializationError error = deserializeJson(doc, client);
  if (error) {
    Serial.println("ERROR: Could not deserialize response from budgeting.robel.dev");
    haltAsError();
  }

  client.stop();
}

void haltAsError() {
  lcd.clear();
  digitalWrite(8, HIGH);
  lcd.setCursor(0, 3);
  lcd.print("ERROR, PROGRAM HALT");
  for (;;) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(100);
    digitalWrite(LED_BUILTIN, LOW);
    delay(100);
  }
}

void haltAsSuccess() {
  lcd.clear();
  digitalWrite(8, HIGH);
  lcd.setCursor(0, 3);
  lcd.print("DONE, PROGRAM HALT");
  for (;;) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(1000);
    digitalWrite(LED_BUILTIN, LOW);
    delay(1000);
  }
}
