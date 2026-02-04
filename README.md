# Amora Crochett Project

Amora is a full-stack web application designed to support a small business ecosystem, combining a public storefront, a digital museum, and an administrative control panel.

The project focuses on practical application development, real business logic, and cloud-based deployment using modern web platforms.

## Project Structure

- **index.html**  
  Main entry point for customers. Displays profile information, product catalog, museum content, featured items, and informational modals.

- **admin.html**  
  Private administrative interface used to manage products, prices, images, and customer reviews.

- **js/app.js**  
  Core client-side logic of the application. Handles navigation, filters, dynamic content rendering, and structured data (JSON-LD) generation for product understanding by search engines and AI systems.

- **js/admin-amora.js**  
  Administrative logic responsible for CRUD operations and moderation tasks, communicating directly with Firebase services.

- **css/styles.css**  
  Visual design and animations for the public-facing site, including branding colors and UI effects.

- **css/styles-amora-admin.css**  
  Dedicated styles for the administrative control panel.

- **firebase-rules.json**  
  Defines database access permissions and security rules.

## Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend Services: Firebase / Firestore
- Hosting & Deployment: Cloudflare Workers
- Development Tools: Visual Studio Code, Git

## Deployment
The application is deployed on Cloudflare Workers, serving static assets with low latency.
HTML files load JavaScript and CSS through relative paths, ensuring the system operates as a single coordinated unit.

## Purpose
This project demonstrates real-world application development, cloud deployment, and system organization for a functional digital product.
It is not a demo or tutorial project, but a practical implementation built for an active use case.


## Notes
This project is intended for technical review and architectural evaluation purposes.
