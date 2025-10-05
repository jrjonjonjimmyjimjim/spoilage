#include <LiquidCrystal.h>
#include <WiFiS3.h>
#include <WiFiSSLClient.h>

#include <ArduinoJson.h>

#include "arduino_secrets.h"

char ssid[] = SECRET_SSID;
char pass[] = SECRET_PASS;
char server[] = "budgeting.robel.dev";
const int serverPort = 8443;
const int MAX_ITEM_COUNT = 32;

typedef struct Item{
  int Id;
  String Name;
  int DaysLeft;
};
struct Item itemsList[MAX_ITEM_COUNT] = {};

int wifiStatus = WL_IDLE_STATUS;
const int rs = 12, en = 11, d4 = 5, d5 = 4, d6 = 3, d7 = 2;

LiquidCrystal lcd(rs, en, d4, d5, d6, d7);
WiFiSSLClient client;

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    ;
  }

  lcd.begin(20, 4);
  lcd.print("SPOILAGE v0.1.0");
  lcd.setCursor(0, 1);
  lcd.print("Network: ");
  lcd.setCursor(9, 1);
  lcd.print(ssid);
  lcd.setCursor(0, 2);
  lcd.print(server);
  lcd.setCursor(0, 3);
  lcd.print("Port: ");
  lcd.setCursor(6, 3);
  lcd.print(serverPort);

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
  // For first iteration:

  // PRINT SPLASH SCREEN
  // summary:
  // MAKE REQUEST TO /api/summary AND STORE THE INFO

  // PRINT FIRST 4 ITEMS IN THE LIST

  // START TIMER FOR 30 SECONDS

  // AFTER 30 SECONDS, TURN OFF THE DISPLAY AND LISTEN TO ACCELEROMETER INPUT

  // ON ACCELEROMETER INPUT, PRINT MESSAGE ABOUT FETCHING ITEMS AND JUMP TO summary
  JsonDocument doc;
  apiRequest("GET /api/summary", "", doc);

  JsonArray items = doc["items"];
  Serial.println(String(items[0]["item_name"]));

  int itemIndex = 0;
  for (JsonVariant item : items) {
    itemsList[itemIndex].Id = item["item_id"];
    itemsList[itemIndex].Name = String(item["item_name"]);
    itemsList[itemIndex].DaysLeft = item["days_till_expiration"];
    Serial.println("Adding entry to itemsList");
    Serial.println(itemsList[itemIndex].Id);
    Serial.println(itemsList[itemIndex].Name);
    Serial.println(itemsList[itemIndex].DaysLeft);

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
    Serial.println(itemsList[i].DaysLeft);
    Serial.println(daysLeftString.length());
    lcd.setCursor(19-daysLeftString.length()-1, i);
    lcd.write(" ");
    lcd.setCursor(19-daysLeftString.length(), i);
    lcd.write(daysLeftString.c_str());
    lcd.setCursor(19, i);
    lcd.write("d");
  }

  for (;;) {}

  if (!client.connected()) {
    Serial.println("Disconnecting from server");
    client.stop();

    haltAsSuccess();
  }
}

void apiRequest(char endpoint[], char body[], JsonDocument &doc) {
  while (client.connected()) {
    Serial.println("Waiting for previous connection to close");
    digitalWrite(LED_BUILTIN, HIGH);
    delay(100);
    digitalWrite(LED_BUILTIN, LOW);
    delay(500);
  }
  Serial.print("\nCalling server: "); Serial.println(endpoint);
  Serial.println(body);
  if (client.connect(server, serverPort)) {
    Serial.println("Connected to server");
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
