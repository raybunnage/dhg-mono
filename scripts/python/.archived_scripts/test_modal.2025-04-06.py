#\!/usr/bin/env python
import modal

# Create a simple app
stub = modal.Stub("test-app")

@stub.function()
def square(x):
    return x * x

if __name__ == "__main__":
    with stub.run():
        result = square.remote(4)
        print(f"The square of 4 is {result}")
