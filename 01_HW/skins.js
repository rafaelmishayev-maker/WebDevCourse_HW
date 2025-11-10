// List of available SKIN files
const skins = [
    "./SKINS/dark.css",
    "./SKINS/basic.css",
    "./SKINS/modern.css"
];

let current = 0; // Current active skin index

// Wait until the page has fully loaded
document.addEventListener("DOMContentLoaded", () => {
    // Create a button dynamically
    const button = document.createElement("button");
    button.textContent = "Change SKIN";
    button.style.margin = "20px";
    button.style.padding = "10px 15px";
    button.style.fontSize = "16px";
    button.style.cursor = "pointer";

    // Add button to the top of the page
    document.body.prepend(button);

    // Listen for button clicks
    button.addEventListener("click", () => {
        // Move to the next skin
        current++;

        // If reached the end → go back to the first
        if (current >= skins.length) {
            current = 0;
        }

        // Replace the stylesheet link dynamically
        const link = document.getElementById("skinLink");
        link.setAttribute("href", skins[current]);
    });
});
