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

To use this application, you need a valid **Prediko API Key** (`pk_live_...`). Your key is stored locally and is **never** uploaded to GitHub.

### **Option 1: In-App Settings (Recommended)**
1.  Open the application.
2.  Click the **Settings (⚙️)** icon in the top-right corner.
3.  Paste your API key into the field.
4.  Click **Save Key**. The app will remember your key automatically.

### **Option 2: Manual Setup**
1.  Create a file named **`donaventory.key`** in the root directory (same place as the launch scripts).
2.  Paste your raw API key (e.g., `pk_live_YOUR_KEY_HERE`) into the file and save it.
3.  Restart the application if it was already running.

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
