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
			Key            int16  `json:"item_id"`
			Name           string `json:"item_name"`
			ExpirationDate string `json:"expires"`
		}
		var existingItemResponses []ExistingItemResponse

		itemRows, err := db.Query("SELECT key, name, expiration_date FROM items ORDER BY expiration_date")
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

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, "%s", string(jsonResponse))
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
		}
		var updateItemRequest UpdateItemRequest
		err = json.Unmarshal(requestBodyBytes, &updateItemRequest)
		panicIfErr(err)

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

	getApiAuthHandler := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("WWW-Authenticate", `Basic realm="User Visible Realm"`)
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprintf(w, `{"status": "Unauthorized"}`)
	}
	router.HandleFunc("GET /api/auth", getApiAuthHandler)

	server := http.Server{
		Addr: ":8080",
		Handler: middleware.BasicAuth(
			middleware.AllowCors(router), // TODO: CORS may not be necessary once this is up and running
			db,
		),
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
			hash string
		);
	`)
	panicIfErr(err)
	_, err = createTableStatement.Exec()
	panicIfErr(err)
	createTableStatement.Close()

	type UserLogin struct {
		User     string
		Password string
		Hash     string
	}
	usersJson, err := os.ReadFile("users.json")
	panicIfErr(err)

	var logins []UserLogin
	err = json.Unmarshal(usersJson, &logins)
	panicIfErr(err)

	for i, login := range logins {
		userString := login.User + ":" + login.Password
		userHash := base64.StdEncoding.EncodeToString([]byte(userString))
		logins[i].Hash = userHash
	}

	addUserStatement, err := db.Prepare(`
		INSERT INTO users (user, hash) VALUES (?, ?) 
	`)
	for _, login := range logins {
		panicIfErr(err)

		_, err := addUserStatement.Exec(login.User, login.Hash)
		panicIfErr(err)
	}
	addUserStatement.Close()
}
