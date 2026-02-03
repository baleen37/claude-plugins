// Sample Go file for testing AST patterns

package main

import "fmt"

// Greeter greets people
type Greeter struct {
	Greeting string
}

// Greet returns a greeting
func (g *Greeter) Greet(name string) string {
	return fmt.Sprintf("%s, %s!", g.Greeting, name)
}

// Farewell says goodbye
func Farewell(name string) string {
	return fmt.Sprintf("Goodbye, %s!", name)
}

// Person represents a person
type Person struct {
	Name string
	Age  int
}

func main() {
	greeter := &Greeter{Greeting: "Hello"}
	fmt.Println(greeter.Greet("World"))
}
