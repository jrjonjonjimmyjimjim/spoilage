package middleware

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	_ "modernc.org/sqlite"
)

func BasicAuth(next http.Handler, db *sql.DB) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("WWW-Authenticate", `Basic realm="User Visible Realm"`)
		auth := r.Header.Get("Authorization")
		fmt.Printf("Authorization header: %s", auth)

		authHeader := strings.Split(auth, " ")
		if len(authHeader) == 2 && authHeader[0] == "Basic" {
			userRow := db.QueryRow("SELECT user FROM users WHERE hash = ?", authHeader[1])
			rowResult := userRow.Scan()
			if rowResult == sql.ErrNoRows {
				fmt.Println("User-attempted authentication failure.")
				w.WriteHeader(http.StatusUnauthorized)
				fmt.Fprintf(w, `{"status": "Unauthorized"}`)
			} else {
				fmt.Println("User is authenticated!")
				next.ServeHTTP(w, r)
			}
		} else {
			fmt.Println("User-attempted authentication failure.")
			w.WriteHeader(http.StatusUnauthorized)
			fmt.Fprintf(w, `{"status": "Unauthorized"}`)
		}
	})
}
