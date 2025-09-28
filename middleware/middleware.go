package middleware

import "net/http"

func AllowCors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// TODO: This should just set CORS, not also content type
		w.Header().Set("Content-Type", "application/json")
		// TODO: This could return the Origin on the header of the request rather than a hardcoded string
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "content-type")
		w.Header().Set("Access-Control-Allow-Methods", "PUT, DELETE")
		next.ServeHTTP(w, r)
	})
}
