// Sample Rust file for testing AST patterns

/// A struct that greets people
pub struct Greeter {
    greeting: String,
}

impl Greeter {
    /// Create a new greeter
    pub fn new(greeting: &str) -> Self {
        Greeter {
            greeting: greeting.to_string(),
        }
    }

    /// Greet someone by name
    pub fn greet(&self, name: &str) -> String {
        format!("{}, {}!", self.greeting, name)
    }
}

/// Say goodbye to someone
pub fn farewell(name: &str) -> String {
    format!("Goodbye, {}!", name)
}

/// A person struct
pub struct Person {
    pub name: String,
    pub age: u32,
}

fn main() {
    let greeter = Greeter::new("Hello");
    println!("{}", greeter.greet("World"));
}
