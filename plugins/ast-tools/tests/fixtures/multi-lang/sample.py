"""Sample Python file for testing AST patterns"""


def greet(name: str) -> str:
    """Greet someone by name."""
    return f"Hello, {name}!"


def farewell(name: str) -> str:
    """Say goodbye to someone."""
    return f"Goodbye, {name}!"


class Greeter:
    """A class that greets people."""

    def __init__(self, greeting: str):
        self.greeting = greeting

    def say(self, name: str) -> str:
        """Say greeting to name."""
        return f"{self.greeting}, {name}!"


# Simple assignments
x = 1
y = "hello"
z = [1, 2, 3]
