flowchart TD
    A[User Visits App]
    A --> B{Authenticated?}
    B -- No --> C[SignIn or SignUp Page]
    B -- Yes --> D[Dashboard Page]
    C --> E{Has Account?}
    E -- Yes --> F[SignIn Form]
    E -- No --> G[SignUp Form]
    F --> H[Submit Credentials]
    G --> I[Submit Registration]
    H --> J{Credentials Valid?}
    J -- Yes --> D
    J -- No --> K[Show Auth Error]
    I --> L[Create Account]
    L --> D
    D --> M[Load Dashboard Data]
    M --> N{Data Loaded?}
    N -- Yes --> O[Display Dashboard]
    N -- No --> P[Display Error]
    O --> Q[User Interactions]
    Q --> R{Configure Strategy?}
    R -- Yes --> S[Strategy Configuration]
    R -- No --> T[View Trade History]