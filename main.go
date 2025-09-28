package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/jrjonjonjimmyjimjim/spoilage-server/middleware"
	_ "modernc.org/sqlite"
)

var db *sql.DB

func main() {
	fmt.Println("Hello world!")
	var err error
	db, err = sql.Open("sqlite", "database.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	createTableStatement, err := db.Prepare(`
		CREATE TABLE IF NOT EXISTS items (
			key INTEGER PRIMARY KEY,
			name string,
			expiration_date string
		)
	`)
	if err != nil {
		log.Fatal(err)
	}
	_, err = createTableStatement.Exec()
	if err != nil {
		log.Fatal(err)
	}
	createTableStatement.Close()

	catchAllHandler := func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `{"status": "ERROR", "message": "Unsupported API Call"}`)
	}

	getApiSummaryHandler := func(w http.ResponseWriter, r *http.Request) {
		fmt.Println("Received request to list all items")

		type ExistingItemResponse struct {
			Key            int16  `json:"item_id"`
			Name           string `json:"item_name"`
			ExpirationDate string `json:"expires"`
		}
		var existingItemResponses []ExistingItemResponse

		itemRows, err := db.Query("SELECT key, name, expiration_date FROM items")
		panicIfErr(err)
		defer itemRows.Close()

		for itemRows.Next() {
			var existingItemResponse ExistingItemResponse
			err := itemRows.Scan(&existingItemResponse.Key, &existingItemResponse.Name, &existingItemResponse.ExpirationDate)
			panicIfErr(err)
			existingItemResponses = append(existingItemResponses, existingItemResponse)
		}

		var jsonResponse []byte
		jsonResponse, err = json.Marshal(existingItemResponses)
		panicIfErr(err)

		fmt.Fprintf(w, "%s", string(jsonResponse))
	}

	postApiItemHandler := func(w http.ResponseWriter, r *http.Request) {
		requestBody, err := io.ReadAll(r.Body)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("What we got from the request body: %s", requestBody)
		requestBodyBytes := []byte(requestBody)
		type NewItemRequest struct {
			Name           string `json:"item_name"`
			ExpirationDate string `json:"expires"`
		}
		var newItemRequest NewItemRequest
		err = json.Unmarshal(requestBodyBytes, &newItemRequest)
		if err != nil {
			log.Fatal(err)
		}
		addItemStatement, err := db.Prepare("INSERT INTO items (name, expiration_date) VALUES (?, ?)")
		if err != nil {
			log.Fatal(err)
		}
		defer addItemStatement.Close()
		addItemResult, err := addItemStatement.Exec(newItemRequest.Name, newItemRequest.ExpirationDate)
		if err != nil {
			log.Fatal(err)
		}

		id, err := addItemResult.LastInsertId()
		if err != nil {
			log.Fatal(err)
		}
		fmt.Fprintf(w, `{"status": "OK", "item_id": "%v", "item_name": "%s", "expires": "%s"}`, id, newItemRequest.Name, newItemRequest.ExpirationDate)
	}

	router := http.NewServeMux()
	router.HandleFunc("/", catchAllHandler)
	router.HandleFunc("GET /api/summary", getApiSummaryHandler)
	router.HandleFunc("POST /api/item", postApiItemHandler)

	server := http.Server{
		Addr:    ":8080",
		Handler: middleware.AllowCors(router),
	}
	if err := server.ListenAndServe(); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}

func panicIfErr(err error) {
	if err != nil {
		log.Fatal(err)
	}
}
