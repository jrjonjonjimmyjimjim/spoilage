package main

import (
	"fmt"
	"net/http"
)

func main() {
	fmt.Println("Hello world!")

	handler := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")

		fmt.Fprintf(w, "hello world")
	}

	http.HandleFunc("/", handler)
	if err := http.ListenAndServe(":8080", nil); err != nil {
		fmt.Printf("ListenAndServe: %v", err)
	}
}
