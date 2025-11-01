package main

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/jrjonjonjimmyjimjim/spoilage-server/middleware"
	_ "modernc.org/sqlite"
)

var db *sql.DB

func main() {
	fmt.Println("Hello world!")
	var err error
	db, err = sql.Open("sqlite", "database.db")
	panicIfErr(err)
	defer db.Close()

	initializeUsers()
	createTableStatement, err := db.Prepare(`
		CREATE TABLE IF NOT EXISTS items (
			key INTEGER PRIMARY KEY,
			name string,
			expiration_date string
		);
	`)
	panicIfErr(err)
	_, err = createTableStatement.Exec()
	panicIfErr(err)
	createTableStatement.Close()

	fileServer := http.FileServer(http.Dir("./static"))
	http.Handle("/static/", http.StripPrefix("/static/", fileServer))

	catchAllHandler := func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.ServeFile(w, r, "./static/index.html")
			return
		}
		fileServer.ServeHTTP(w, r)
	}

	getApiSummaryHandler := func(w http.ResponseWriter, r *http.Request) {
		fmt.Println("Received request to list all items")

		type ExistingItemResponse struct {
			Key                int16  `json:"item_id"`
			Name               string `json:"item_name"`
			ExpirationDate     string `json:"expires"`
			DaysTillExpiration int16  `json:"days_till_expiration"`
		}
		type SummaryResponse struct {
			Items []ExistingItemResponse `json:"items"`
		}
		var existingItemResponses []ExistingItemResponse

		itemRows, err := db.Query("SELECT key, name, expiration_date FROM items ORDER BY expiration_date")
		panicIfErr(err)
		defer itemRows.Close()

		currentTime := time.Now()
		for itemRows.Next() {
			var existingItemResponse ExistingItemResponse
			err := itemRows.Scan(&existingItemResponse.Key, &existingItemResponse.Name, &existingItemResponse.ExpirationDate)
			panicIfErr(err)
			expirationTime, err := time.Parse("2006-01-02", existingItemResponse.ExpirationDate)
			panicIfErr(err)

			timeTillExpiration := expirationTime.Sub(currentTime)
			daysTillExpiration := int16(timeTillExpiration.Hours() / 24.0)
			existingItemResponse.DaysTillExpiration = daysTillExpiration
			existingItemResponses = append(existingItemResponses, existingItemResponse)
		}
		summaryResponse := SummaryResponse{
			Items: existingItemResponses,
		}

		var jsonResponse []byte
		jsonResponse, err = json.Marshal(summaryResponse)
		panicIfErr(err)

		stringResponse := string(jsonResponse)
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Length", strconv.Itoa(len(stringResponse)))
		fmt.Fprintf(w, "%s", stringResponse)
	}

	postApiItemHandler := func(w http.ResponseWriter, r *http.Request) {
		requestBody, err := io.ReadAll(r.Body)
		panicIfErr(err)
		fmt.Printf("What we got from the request body: %s", requestBody)

		requestBodyBytes := []byte(requestBody)
		type NewItemRequest struct {
			Name           string `json:"item_name"`
			ExpirationDate string `json:"expires"`
		}
		var newItemRequest NewItemRequest
		err = json.Unmarshal(requestBodyBytes, &newItemRequest)
		panicIfErr(err)

		addItemStatement, err := db.Prepare("INSERT INTO items (name, expiration_date) VALUES (?, ?)")
		panicIfErr(err)
		defer addItemStatement.Close()

		addItemResult, err := addItemStatement.Exec(newItemRequest.Name, newItemRequest.ExpirationDate)
		panicIfErr(err)

		id, err := addItemResult.LastInsertId()
		panicIfErr(err)

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status": "OK", "item_id": "%v", "item_name": "%s", "expires": "%s"}`, id, newItemRequest.Name, newItemRequest.ExpirationDate)
	}

	putApiItemHandler := func(w http.ResponseWriter, r *http.Request) {
		requestBody, err := io.ReadAll(r.Body)
		panicIfErr(err)

		fmt.Printf("What we got from the request body: %s", requestBody)
		requestBodyBytes := []byte(requestBody)
		type UpdateItemRequest struct {
			Key            string `json:"item_id"`
			Name           string `json:"item_name"`
			ExpirationDate string `json:"expires"`
			PostponeDays   int16  `json:"postpone_by_days"`
		}
		var updateItemRequest UpdateItemRequest
		err = json.Unmarshal(requestBodyBytes, &updateItemRequest)
		panicIfErr(err)

		if updateItemRequest.PostponeDays > 0 {
			itemRow := db.QueryRow("SELECT name, expiration_date FROM items WHERE key = ?", updateItemRequest.Key)
			var expirationDate string
			err = itemRow.Scan(&updateItemRequest.Name, &expirationDate)
			panicIfErr(err)

			expirationTime, err := time.Parse("2006-01-02", expirationDate)
			panicIfErr(err)

			var postponedExpirationTime time.Time
			timeNow := time.Now()
			if expirationTime.Compare(timeNow) == 1 {
				postponedExpirationTime = expirationTime.AddDate(0, 0, int(updateItemRequest.PostponeDays))
			} else {
				postponedExpirationTime = timeNow.AddDate(0, 0, int(updateItemRequest.PostponeDays))
			}
			updateItemRequest.ExpirationDate = postponedExpirationTime.Format("2006-01-02")
		}
		updateItemStatement, err := db.Prepare("UPDATE items SET name = ?, expiration_date = ? WHERE key = ?")
		panicIfErr(err)
		defer updateItemStatement.Close()

		updateItemRequestKeyAsInt, err := strconv.Atoi(updateItemRequest.Key)
		panicIfErr(err)
		_, err = updateItemStatement.Exec(updateItemRequest.Name, updateItemRequest.ExpirationDate, updateItemRequestKeyAsInt)
		panicIfErr(err)

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status": "OK", "item_id": "%v", "item_name": "%s", "expires": "%s"}`, updateItemRequestKeyAsInt, updateItemRequest.Name, updateItemRequest.ExpirationDate)
	}

	deleteApiItemHandler := func(w http.ResponseWriter, r *http.Request) {
		requestBody, err := io.ReadAll(r.Body)
		panicIfErr(err)

		fmt.Printf("What we got from the request body: %s", requestBody)
		requestBodyBytes := []byte(requestBody)
		type DeleteItemRequest struct {
			Key string `json:"item_id"`
		}
		var deleteItemRequest DeleteItemRequest
		err = json.Unmarshal(requestBodyBytes, &deleteItemRequest)
		panicIfErr(err)

		deleteItemStatement, err := db.Prepare("DELETE FROM items WHERE key = ?")
		panicIfErr(err)
		defer deleteItemStatement.Close()

		deleteItemRequestKeyAsInt, err := strconv.Atoi(deleteItemRequest.Key)
		panicIfErr(err)
		_, err = deleteItemStatement.Exec(deleteItemRequestKeyAsInt)
		panicIfErr(err)

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status": "OK", "item_id": "%v"}`, deleteItemRequestKeyAsInt)
	}

	router := http.NewServeMux()
	router.HandleFunc("/", catchAllHandler)
	router.HandleFunc("GET /api/summary", getApiSummaryHandler)
	router.HandleFunc("POST /api/item", postApiItemHandler)
	router.HandleFunc("PUT /api/item", putApiItemHandler)
	router.HandleFunc("DELETE /api/item", deleteApiItemHandler)

	server := http.Server{
		Addr: ":443",
		Handler: middleware.BasicAuth(
			router,
			db,
		),
	}
	certPath, keyPath := getTlsCertAndKeyPaths()
	if certPath == "" || keyPath == "" {
		fmt.Println("Starting HTTP server (TLS OFF)")
		if err := server.ListenAndServe(); err != nil {
			log.Fatal("ListenAndServe: ", err)
		}
	} else {
		fmt.Println("Starting HTTPS server (TLS ON)")
		if err := server.ListenAndServeTLS(certPath, keyPath); err != nil {
			log.Fatal("ListenAndServeTLS: ", err)
		}
	}
}

func panicIfErr(err error) {
	if err != nil {
		log.Fatal(err)
	}
}

func initializeUsers() {
	dropTableStatement, err := db.Prepare(`
		DROP TABLE IF EXISTS users;
	`)
	panicIfErr(err)
	_, err = dropTableStatement.Exec()
	panicIfErr(err)
	dropTableStatement.Close()

	createTableStatement, err := db.Prepare(`
		CREATE TABLE users (
			user string,
			encoding string
		);
	`)
	panicIfErr(err)
	_, err = createTableStatement.Exec()
	panicIfErr(err)
	createTableStatement.Close()

	type UserLogin struct {
		User     string
		Password string
		Encoding string
	}
	usersJson, err := os.ReadFile("users.json")
	panicIfErr(err)

	var logins []UserLogin
	err = json.Unmarshal(usersJson, &logins)
	panicIfErr(err)

	for i, login := range logins {
		userString := login.User + ":" + login.Password
		userEncoding := base64.StdEncoding.EncodeToString([]byte(userString))
		logins[i].Encoding = userEncoding
	}

	addUserStatement, err := db.Prepare(`
		INSERT INTO users (user, encoding) VALUES (?, ?) 
	`)
	for _, login := range logins {
		panicIfErr(err)

		_, err := addUserStatement.Exec(login.User, login.Encoding)
		panicIfErr(err)
	}
	addUserStatement.Close()
}

func getTlsCertAndKeyPaths() (certPath string, keyPath string) {
	type TlsCertAndKeyPaths struct {
		Cert string `json:"cert"`
		Key  string `json:"key"`
	}
	tlsCertAndKeyPathsJson, err := os.ReadFile("tls.json")
	if err != nil {
		fmt.Println("Error while opening tls.json")
		return "", ""
	}
	var tlsCertAndKeyPaths TlsCertAndKeyPaths
	err = json.Unmarshal(tlsCertAndKeyPathsJson, &tlsCertAndKeyPaths)
	if err != nil {
		fmt.Println("Error while parsing tls.json")
		return "", ""
	}

	return tlsCertAndKeyPaths.Cert, tlsCertAndKeyPaths.Key
}
