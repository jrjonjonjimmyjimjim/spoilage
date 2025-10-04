#include <WiFiS3.h>
#include <WiFiSSLClient.h>

#include "arduino_secrets.h"

char ssid[] = SECRET_SSID;
char pass[] = SECRET_PASS;
char server[] = "budgeting.robel.dev";

int wifiStatus = WL_IDLE_STATUS;

WiFiSSLClient client;

void setup() {
  // put your setup code here, to run once:
  Serial.begin(115200);
  while (!Serial) {
    ;
  }

  pinMode(LED_BUILTIN, OUTPUT);

  Serial.print("Attempting to connect to SSID: ");
  Serial.println(ssid);
  wifiStatus = WiFi.begin(ssid, pass);
  delay(10000);
  if (wifiStatus != WL_CONNECTED) {
    Serial.println("ERROR: Could not connect to WiFi network");
    haltAsError();
  }

  Serial.println("\nStarting connection to server");

  if (client.connect(server, 8443)) {
    Serial.println("Connected to server");
    client.println("GET /api/summary HTTP/1.1");
    client.println("Host: budgeting.robel.dev");
    client.print("Authorization: Basic "); client.println(SECRET_AUTH);
    client.println("Connection: close");
    client.println();
  } else {
    Serial.println("ERROR: Could not connect to budgeting.robel.dev");
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
  read_response();

  if (!client.connected()) {
    Serial.println("Disconnecting from server");
    client.stop();

    haltAsSuccess();
  }
}

// TODO: This should be adapted to return a variable length string of the response body.
// It should also take in the "GET /api/summary" part of the request and handle making the connection.
void read_response() {
/* -------------------------------------------------------------------------- */
  uint32_t received_data_num = 0;
  while (client.available()) {
    /* actual data reception */
    char c = client.read();
    /* print data to serial port */
    Serial.print(c);
    /* wrap data to 80 columns*/
    received_data_num++;
    if(received_data_num % 80 == 0) {
      Serial.println();
    }
  }
}

void haltAsError() {
  for (;;) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(100);
    digitalWrite(LED_BUILTIN, LOW);
    delay(100);
  }
}

void haltAsSuccess() {
  for (;;) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(1000);
    digitalWrite(LED_BUILTIN, LOW);
    delay(1000);
  }
}
