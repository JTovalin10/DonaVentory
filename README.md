# DonaVentory Production Intake

DonaVentory is a streamlined production management tool designed to work seamlessly with the Prediko API. It allows users to record production runs, handle automatic Bill of Materials (BOM) deductions, and manage inventory stock levels with a simple search-and-select interface.

## 🚀 Quick Start

To run the application on your computer, use the provided launch scripts:

### **Windows**
1.  Navigate to the project folder.
2.  Double-click **`Launch-DonaVentory.bat`**.
3.  The application will start in the background and open your default browser to `http://localhost:5173`.

### **macOS**
1.  Navigate to the project folder.
2.  Double-click **`Launch-DonaVentory.command`**.
3.  The application will start and open your browser automatically.

---

## 🔑 API Key Setup

To use this application, you need to set up your **Prediko API Key** in a `.env` file.

1.  In the project root directory, create a file named **`.env`**.
2.  Add the following lines to the file:
    ```text
    VITE_VERSION="v1"
    VITE_PREDIKO_AUTH_KEY="Bearer pk_live_YOUR_KEY_HERE"
    ```
3.  Save the file and restart the application.

*Note: The `.env` file is ignored by Git and will not be uploaded to GitHub.*

---

## 📋 Features

-   **Product Search**: Quickly find products by name or variant.
-   **Automated BOM**: Ties production intake to your Bill of Materials, deducting raw materials automatically in Prediko.
-   **Intake Tracking**: Records production runs with unique identifiers including your name and the current timestamp.
-   **Inventory Math**: Handles "Received" vs "Ordered" logic server-side so the client is always accurate.
-   **Keyboard Shortcuts**: Hit **Enter** to search and **Enter** again to confirm production for lightning-fast recording.

---

## 🛠 Developer Setup

If you prefer to run the app via the command line:

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Start the development server**:
    ```bash
    npm run dev
    ```
3.  **Build for production**:
    ```bash
    npm run build
    ```
