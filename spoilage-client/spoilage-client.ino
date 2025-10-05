#include <LiquidCrystal.h>
#include <WiFiS3.h>
#include <WiFiSSLClient.h>

#include <ArduinoJson.h>

#include "arduino_secrets.h"

char ssid[] = SECRET_SSID;
char pass[] = SECRET_PASS;
char server[] = "budgeting.robel.dev";

int wifiStatus = WL_IDLE_STATUS;
const int rs = 12, en = 11, d4 = 5, d5 = 4, d6 = 3, d7 = 2;

LiquidCrystal lcd(rs, en, d4, d5, d6, d7);
WiFiSSLClient client;

void setup() {
  // put your setup code here, to run once:
  Serial.begin(115200);
  while (!Serial) {
    ;
  }

  lcd.begin(20, 4);
  lcd.print("SPOILAGE v0.1.0");
  lcd.setCursor(0, 1);
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

  Serial.println((String)(doc[0]["item_name"]));
  /*
  for (JsonVariant item : doc) {
    Serial.print(item["item_id"]); Serial.print(item["item_name"]); Serial.print(item["expires"]); Serial.println(item["days_till_expiration"]);
  }
  */

  if (!client.connected()) {
    Serial.println("Disconnecting from server");
    client.stop();

    haltAsSuccess();
  }
}

// TODO: This should be adapted to return a variable length string of the response body.
// It should also take in the "GET /api/summary" part of the request and handle making the connection.
void apiRequest(char endpoint[], char body[], JsonDocument doc) {
  Serial.print("\nCalling server: "); Serial.println(endpoint);
  Serial.println(body);
  if (client.connect(server, 8443)) {
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
