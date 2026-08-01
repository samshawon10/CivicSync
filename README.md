# 🚀 CivicSync – Smart Citizen Service & Public Safety Platform

> Empowering citizens through technology for smarter public services and safer communities.

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![MERN](https://img.shields.io/badge/Stack-MERN-green)
![Status](https://img.shields.io/badge/Status-Under%20Development-orange)

## 📖 Overview

CivicSync is a MERN Stack-based web application designed to modernize civic issue management and emergency response. It provides a centralized platform where citizens can report public issues, request emergency assistance, and track service progress in real time.

The platform bridges the gap between citizens, government departments, and emergency responders by integrating AI-assisted issue classification, GPS location services, and real-time communication.

---

## 🎯 Problem Statement

Traditional methods of reporting civic issues rely on phone calls, social media, or messaging applications, resulting in:

- Lack of transparency
- Delayed issue resolution
- Duplicate complaints
- Poor communication between citizens and authorities

Emergency situations also suffer from the absence of a centralized digital platform capable of providing instant assistance and live location sharing.

---

## 💡 Solution

CivicSync provides a centralized digital platform where citizens can:

- Report civic issues with GPS location
- Upload images and videos
- Track complaint status in real time
- Send emergency SOS requests
- Share live location during emergencies
- Find nearby police stations and hospitals

Government departments receive complaints automatically and can update their progress through dedicated dashboards.

---

# ✨ Features

## 🏙️ Civic Service Module

- 🔐 Secure Authentication
- 📍 GPS-Based Issue Reporting
- 📷 Image & Video Upload
- 🤖 AI-Assisted Issue Classification
- 🔍 Duplicate Issue Detection
- 🗺️ Interactive City Map
- 📊 Complaint Tracking
- ✅ Before & After Verification
- 👥 Community Verification

---

## 🚨 Emergency Safety Module

- 🆘 One-Tap SOS
- 📡 Live Location Sharing
- 📧 Emergency Contact Alerts
- 🚓 Nearby Police Finder
- 🏥 Nearby Hospital Finder
- 📄 Incident Reporting
- 📈 Emergency Status Tracking

---

## 👨‍💼 Admin Module

- User Management
- Department Management
- Officer Assignment
- Complaint Monitoring
- Emergency Monitoring
- Analytics Dashboard
- Report Generation

---

# 👥 User Roles

## 👤 Citizen

- Register/Login
- Report Civic Issues
- Upload Images & Videos
- Track Complaint Progress
- Verify Completed Work
- Community Voting
- Send SOS
- Share Live Location

---

## 🏢 Department Officer

- View Assigned Complaints
- Update Complaint Status
- Upload Completion Images
- Manage Department Issues

---

## 🚑 Emergency Officer

- Receive SOS Requests
- View Live Location
- Update Emergency Status
- Coordinate Rescue Operations

---

## 👑 Admin

- Manage Users
- Manage Departments
- Assign Officers
- View Reports
- Monitor Emergency Requests
- System Analytics

---

# 🛠️ Technology Stack

## Frontend

- React.js
- Tailwind CSS
- React Router
- Axios
- Socket.io Client

## Backend

- Node.js
- Express.js
- JWT Authentication
- Socket.io
- Multer

## Database

- MongoDB
- Mongoose

## Cloud Services

- Cloudinary

## Maps & Location

- Google Maps API / OpenStreetMap
- Browser Geolocation API

## Security

- JWT
- bcrypt

## AI (Optional)

- Rule-Based Classification
- Hugging Face API
- OpenAI API (Future Enhancement)

---

# 🏗️ System Architecture

```
Citizen
    │
    ▼
React Frontend
    │
    ▼
Node.js + Express API
    │
 ┌──┴──────────┐
 │             │
 ▼             ▼
MongoDB     Socket.io
 │             │
 ▼             ▼
Cloudinary   Real-Time Updates
```

---

# 🔄 Workflow

### Civic Issue Reporting

1. User logs in.
2. Reports an issue.
3. Uploads images/videos.
4. GPS location is captured.
5. AI classifies the issue.
6. Complaint is assigned to the appropriate department.
7. Officer updates status.
8. Citizen tracks progress.
9. Community verifies completion.

### Emergency Response

1. User presses SOS.
2. Live location is shared.
3. Emergency officers receive alerts.
4. Nearby hospitals and police stations are displayed.
5. Emergency status is updated in real time.

---

# 📁 Project Structure

```
CivicSync/
│
├── client/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── server/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── socket/
│   └── package.json
│
├── README.md
└── .env
```

---

# 🚀 Installation

## Clone Repository

```bash
git clone https://github.com/yourusername/CivicSync.git
```

## Install Frontend

```bash
cd client
npm install
```

## Install Backend

```bash
cd ../server
npm install
```

## Environment Variables

Create a `.env` file:

```env
PORT=5000

MONGODB_URI=

JWT_SECRET=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

GOOGLE_MAPS_API_KEY=
```

---

# ▶️ Run Project

Frontend

```bash
npm run dev
```

Backend

```bash
npm start
```

---

# 📸 Screenshots

> Coming Soon...

---

# 🔮 Future Improvements

- AI Chatbot
- Mobile Application
- Push Notifications
- SMS Alerts
- Multi-language Support
- Predictive Analytics
- Government API Integration

---

# 🤝 Team

## Dark Coders

**Software Engineering Laboratory**

Department of Computer Science & Engineering

United International University (UIU)

---

# 📚 References

- https://www.fixmystreet.com/
- https://seeclickfix.com/
- https://www.grs.gov.bd/
- https://www.999.gov.bd/
- https://rapidsos.com/
- https://portal.311.nyc.gov/

---

# 📄 License

This project is developed for academic purposes as part of the **Software Engineering Laboratory** course at **United International University (UIU)**.

---

⭐ If you like this project, don't forget to star the repository!
