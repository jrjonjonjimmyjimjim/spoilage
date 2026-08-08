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
	"strings"
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
	initializeTables()

	fileServer := http.FileServer(http.Dir("./static"))
	http.Handle("/static/", http.StripPrefix("/static/", fileServer))

	catchAllHandler := func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.ServeFile(w, r, "./static/index.html")
			return
		}
		fileServer.ServeHTTP(w, r)
	}

	getAPIInventorySummaryHandler := func(w http.ResponseWriter, r *http.Request) {
		fmt.Println("Received request to list all items")

		type ExistingItemResponse struct {
			Key                int16  `json:"item_id"`
			Name               string `json:"item_name"`
			ExpirationDate     string `json:"expires"`
			DaysTillExpiration int16  `json:"days_till_expiration"`
			PostponeCount      int16  `json:"postpone_count"`
		}
		type SummaryResponse struct {
			Items          []ExistingItemResponse `json:"items"`
			TrashDay       string                 `json:"trash_day"`
			ArduinoMessage string                 `json:"arduino_message"`
		}
		var existingItemResponses []ExistingItemResponse

		itemRows, err := db.Query("SELECT key, name, expiration_date, postpone_count FROM items ORDER BY expiration_date")
		panicIfErr(err)
		defer itemRows.Close()

		currentTime := time.Now()
		for itemRows.Next() {
			var existingItemResponse ExistingItemResponse
			err := itemRows.Scan(&existingItemResponse.Key, &existingItemResponse.Name, &existingItemResponse.ExpirationDate, &existingItemResponse.PostponeCount)
			panicIfErr(err)
			expirationTime, err := time.Parse("2006-01-02", existingItemResponse.ExpirationDate)
			panicIfErr(err)

			timeTillExpiration := expirationTime.Sub(currentTime)
			daysTillExpiration := int16(timeTillExpiration.Hours() / 24.0)
			existingItemResponse.DaysTillExpiration = daysTillExpiration
			existingItemResponses = append(existingItemResponses, existingItemResponse)
		}

		auth := r.Header.Get("Authorization")
		authHeader := strings.Split(auth, " ")
		userRow := db.QueryRow("SELECT trash_day FROM users WHERE encoding = ?", authHeader[1])
		var trashDay string
		err = userRow.Scan(&trashDay)
		if err != nil {
			// Ignore
		}

		tomorrowTime := currentTime.Add(time.Hour * 24)
		tomorrowIsTrashDay := trashDay == strings.ToLower(tomorrowTime.Weekday().String())
		var arduinoMessage string
		if tomorrowIsTrashDay {
			arduinoMessage = "Trash day is\ntomorrow!\nClean out anything\nthat's expiring!"
		}

		summaryResponse := SummaryResponse{
			Items:          existingItemResponses,
			TrashDay:       trashDay,
			ArduinoMessage: arduinoMessage,
		}

		var jsonResponse []byte
		jsonResponse, err = json.Marshal(summaryResponse)
		panicIfErr(err)

		stringResponse := string(jsonResponse)
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Length", strconv.Itoa(len(stringResponse)))
		fmt.Fprintf(w, "%s", stringResponse)
	}

	postAPIInventoryItemHandler := func(w http.ResponseWriter, r *http.Request) {
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

	putAPIInventoryItemHandler := func(w http.ResponseWriter, r *http.Request) {
		requestBody, err := io.ReadAll(r.Body)
		panicIfErr(err)

		fmt.Printf("What we got from the request body: %s", requestBody)
		requestBodyBytes := []byte(requestBody)
		type UpdateItemRequest struct {
			Key            int16  `json:"item_id"`
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

			updateItemPostponeDaysStatement, err := db.Prepare("UPDATE items SET postpone_count = postpone_count + 1 WHERE key = ?")
			panicIfErr(err)
			defer updateItemPostponeDaysStatement.Close()

			_, err = updateItemPostponeDaysStatement.Exec(updateItemRequest.Key)
			panicIfErr(err)
		}
		updateItemStatement, err := db.Prepare("UPDATE items SET name = ?, expiration_date = ? WHERE key = ?")
		panicIfErr(err)
		defer updateItemStatement.Close()

		_, err = updateItemStatement.Exec(updateItemRequest.Name, updateItemRequest.ExpirationDate, updateItemRequest.Key)
		panicIfErr(err)

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status": "OK", "item_id": "%v", "item_name": "%s", "expires": "%s"}`, updateItemRequest.Key, updateItemRequest.Name, updateItemRequest.ExpirationDate)
	}

	deleteAPIInventoryItemHandler := func(w http.ResponseWriter, r *http.Request) {
		requestBody, err := io.ReadAll(r.Body)
		panicIfErr(err)

		fmt.Printf("What we got from the request body: %s", requestBody)
		requestBodyBytes := []byte(requestBody)
		type DeleteItemRequest struct {
			Key int16 `json:"item_id"`
		}
		var deleteItemRequest DeleteItemRequest
		err = json.Unmarshal(requestBodyBytes, &deleteItemRequest)
		panicIfErr(err)

		deleteItemStatement, err := db.Prepare("DELETE FROM items WHERE key = ?")
		panicIfErr(err)
		defer deleteItemStatement.Close()

		_, err = deleteItemStatement.Exec(deleteItemRequest.Key)
		panicIfErr(err)

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status": "OK", "item_id": "%v"}`, deleteItemRequest.Key)
	}

	getAPIShoppingListsSummaryHandler := func(w http.ResponseWriter, r *http.Request) {
		fmt.Println("Received request to list all items")

		type ExistingItemResponse struct {
			Key      int16  `json:"item_id"`
			Name     string `json:"item_name"`
			Aisle    string `json:"aisle"`
			Quantity string `json:"quantity"`
		}
		type ExistingListResponse struct {
			Key   int16                  `json:"list_id"`
			Name  string                 `json:"list_name"`
			Items []ExistingItemResponse `json:"items"`
		}
		type SummaryResponse struct {
			Lists []ExistingListResponse `json:"lists"`
		}
		var existingItemResponses []ExistingItemResponse

		itemRows, err := db.Query(`
		SELECT
			item.key,
			item.name,
			item.aisle,
			item.quantity,
			list.name
		FROM
			shopping_lists_items AS item,
			shopping_lists_lists AS list
		WHERE
			item.list = list.key
		`)
		panicIfErr(err)
		defer itemRows.Close()

		currentTime := time.Now()
		var existingListResponse ExistingListResponse
		for itemRows.Next() {
			var existingItemResponse ExistingItemResponse
			var listName string
			err := itemRows.Scan(&existingItemResponse.Key, &existingItemResponse.Name, &existingItemResponse.Aisle, &existingItemResponse.Quantity, &listName)
			panicIfErr(err)
		}

		auth := r.Header.Get("Authorization")
		authHeader := strings.Split(auth, " ")
		userRow := db.QueryRow("SELECT trash_day FROM users WHERE encoding = ?", authHeader[1])
		var trashDay string
		err = userRow.Scan(&trashDay)
		if err != nil {
			// Ignore
		}

		tomorrowTime := currentTime.Add(time.Hour * 24)
		tomorrowIsTrashDay := trashDay == strings.ToLower(tomorrowTime.Weekday().String())
		var arduinoMessage string
		if tomorrowIsTrashDay {
			arduinoMessage = "Trash day is\ntomorrow!\nClean out anything\nthat's expiring!"
		}

		summaryResponse := SummaryResponse{
			Items:          existingItemResponses,
			TrashDay:       trashDay,
			ArduinoMessage: arduinoMessage,
		}

		var jsonResponse []byte
		jsonResponse, err = json.Marshal(summaryResponse)
		panicIfErr(err)

		stringResponse := string(jsonResponse)
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Length", strconv.Itoa(len(stringResponse)))
		fmt.Fprintf(w, "%s", stringResponse)
	}

	postAPIShoppingListsItemHandler := func(w http.ResponseWriter, r *http.Request) {
		requestBody, err := io.ReadAll(r.Body)
		panicIfErr(err)
		fmt.Printf("What we got from the request body: %s", requestBody)

		requestBodyBytes := []byte(requestBody)
		type NewItemRequest struct {
			Name     string `json:"item_name"`
			Aisle    string `json:"aisle"`
			Quantity string `json:"quantity"`
		}
		var newItemRequest NewItemRequest
		err = json.Unmarshal(requestBodyBytes, &newItemRequest)
		panicIfErr(err)

		addItemStatement, err := db.Prepare("INSERT INTO shopping_lists_items (name, aisle, quantity) VALUES (?, ?, ?)")
		panicIfErr(err)
		defer addItemStatement.Close()

		addItemResult, err := addItemStatement.Exec(newItemRequest.Name, newItemRequest.Aisle, newItemRequest.Quantity)
		panicIfErr(err)

		id, err := addItemResult.LastInsertId()
		panicIfErr(err)

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status": "OK", "item_id": "%v", "item_name": "%s", "aisle": "%s", "quantity": "%s"}`, id, newItemRequest.Name, newItemRequest.Aisle, newItemRequest.Quantity)
	}

	putAPIShoppingListsItemHandler := func(w http.ResponseWriter, r *http.Request) {
		requestBody, err := io.ReadAll(r.Body)
		panicIfErr(err)

		fmt.Printf("What we got from the request body: %s", requestBody)
		requestBodyBytes := []byte(requestBody)
		type UpdateItemRequest struct {
			Key      int16  `json:"item_id"`
			Name     string `json:"item_name"`
			Aisle    string `json:"aisle"`
			Quantity string `json:"quantity"`
		}
		var updateItemRequest UpdateItemRequest
		err = json.Unmarshal(requestBodyBytes, &updateItemRequest)
		panicIfErr(err)

		updateItemStatement, err := db.Prepare("UPDATE shopping_lists_items SET name = ?, aisle = ?, quantity = ? WHERE key = ?")
		panicIfErr(err)
		defer updateItemStatement.Close()

		_, err = updateItemStatement.Exec(updateItemRequest.Name, updateItemRequest.Aisle, updateItemRequest.Quantity, updateItemRequest.Key)
		panicIfErr(err)

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status": "OK", "item_id": "%v", "item_name": "%s", "aisle": "%s", "quantity": "%s"}`, updateItemRequest.Key, updateItemRequest.Name, updateItemRequest.Aisle, updateItemRequest.Quantity)
	}

	deleteAPIShoppingListsItemHandler := func(w http.ResponseWriter, r *http.Request) {
		requestBody, err := io.ReadAll(r.Body)
		panicIfErr(err)

		fmt.Printf("What we got from the request body: %s", requestBody)
		requestBodyBytes := []byte(requestBody)
		type DeleteItemRequest struct {
			Key int16 `json:"item_id"`
		}
		var deleteItemRequest DeleteItemRequest
		err = json.Unmarshal(requestBodyBytes, &deleteItemRequest)
		panicIfErr(err)

		deleteItemStatement, err := db.Prepare("DELETE FROM shopping_lists_items WHERE key = ?")
		panicIfErr(err)
		defer deleteItemStatement.Close()

		_, err = deleteItemStatement.Exec(deleteItemRequest.Key)
		panicIfErr(err)

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status": "OK", "item_id": "%v"}`, deleteItemRequest.Key)
	}

	postAPIShoppingListsListHandler := func(w http.ResponseWriter, r *http.Request) {
		requestBody, err := io.ReadAll(r.Body)
		panicIfErr(err)
		fmt.Printf("What we got from the request body: %s", requestBody)

		requestBodyBytes := []byte(requestBody)
		type NewListRequest struct {
			Name string `json:"list_name"`
		}
		var newListRequest NewListRequest
		err = json.Unmarshal(requestBodyBytes, &newListRequest)
		panicIfErr(err)

		addItemStatement, err := db.Prepare("INSERT INTO shopping_lists_lists (name) VALUES (?)")
		panicIfErr(err)
		defer addItemStatement.Close()

		addItemResult, err := addItemStatement.Exec(newListRequest.Name)
		panicIfErr(err)

		id, err := addItemResult.LastInsertId()
		panicIfErr(err)

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status": "OK", "list_id": "%v", "list_name": "%s"}`, id, newListRequest.Name)
	}

	putAPIConfigHandler := func(w http.ResponseWriter, r *http.Request) {
		requestBody, err := io.ReadAll(r.Body)
		panicIfErr(err)

		fmt.Printf("What we got from the request body: %s", requestBody)
		requestBodyBytes := []byte(requestBody)
		type UpdateConfigRequest struct {
			TrashDay string `json:"trash_day"`
		}
		var updateConfigRequest UpdateConfigRequest
		err = json.Unmarshal(requestBodyBytes, &updateConfigRequest)
		panicIfErr(err)

		updateConfigStatement, err := db.Prepare("UPDATE users SET trash_day = ? WHERE encoding = ?")
		panicIfErr(err)
		defer updateConfigStatement.Close()

		auth := r.Header.Get("Authorization")
		authHeader := strings.Split(auth, " ")

		_, err = updateConfigStatement.Exec(updateConfigRequest.TrashDay, authHeader[1])
		panicIfErr(err)

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status": "OK", "trash_day": "%s"}`, updateConfigRequest.TrashDay)
	}

	router := http.NewServeMux()
	router.HandleFunc("/", catchAllHandler)
	router.HandleFunc("GET /api/inventory_summary", getAPIInventorySummaryHandler)
	router.HandleFunc("POST /api/inventory_item", postAPIInventoryItemHandler)
	router.HandleFunc("PUT /api/inventory_item", putAPIInventoryItemHandler)
	router.HandleFunc("DELETE /api/inventory_item", deleteAPIInventoryItemHandler)
	router.HandleFunc("POST /api/shopping_lists_item", postAPIShoppingListsItemHandler)
	router.HandleFunc("PUT /api/shopping_lists_item", putAPIShoppingListsItemHandler)
	router.HandleFunc("DELETE /api/shopping_lists_item", deleteAPIShoppingListsItemHandler)
	router.HandleFunc("POST /api/shopping_lists_list", postAPIShoppingListsListHandler)
	router.HandleFunc("PUT /api/config", putAPIConfigHandler)

	certPath, keyPath := getTlsCertAndKeyPaths()
	serverAddr := ":443"
	if certPath == "" || keyPath == "" {
		serverAddr = ":8080"
	}
	server := http.Server{
		Addr: serverAddr,
		Handler: middleware.BasicAuth(
			router,
			db,
		),
	}
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

func initializeTables() {
	createInventoryItemsTableStatement, err := db.Prepare(`
		CREATE TABLE IF NOT EXISTS inventory_items (
			key INTEGER PRIMARY KEY,
			name string,
			expiration_date string,
			postpone_count INTEGER DEFAULT 0
		);
	`)
	panicIfErr(err)
	_, err = createInventoryItemsTableStatement.Exec()
	panicIfErr(err)
	createInventoryItemsTableStatement.Close()

	createShoppingListsItemsTableStatement, err := db.Prepare(`
		CREATE TABLE IF NOT EXISTS shopping_lists_items (
			key INTEGER PRIMARY KEY,
			name string,
			aisle string,
			quantity string,
			list INTEGER
		);
	`)
	panicIfErr(err)
	_, err = createShoppingListsItemsTableStatement.Exec()
	panicIfErr(err)
	createShoppingListsItemsTableStatement.Close()

	createShoppingListsListsTableStatement, err := db.Prepare(`
		CREATE TABLE IF NOT EXISTS shopping_lists_lists (
			key INTEGER PRIMARY KEY,
			name string,
		);
	`)
	panicIfErr(err)
	_, err = createShoppingListsListsTableStatement.Exec()
	panicIfErr(err)
	createShoppingListsListsTableStatement.Close()
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
			encoding string,
			trash_day string
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
		INSERT INTO users (user, encoding, trash_day) VALUES (?, ?, 'sunday') 
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
