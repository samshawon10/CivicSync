# 🚀 CivicSync – Smart Citizen Service & Public Safety Platform

> **Empowering Citizens Through Smart Digital Governance**

![Status](https://img.shields.io/badge/Status-Under%20Development-orange)
![Stack](https://img.shields.io/badge/Stack-MERN-success)
![License](https://img.shields.io/badge/License-Academic-blue)
![Version](https://img.shields.io/badge/Version-1.0-brightgreen)

---

# 📖 Overview

CivicSync is a MERN Stack-based Smart Citizen Service and Public Safety Platform developed as part of the **Software Engineering Laboratory** course at **United International University (UIU)**.

The platform aims to modernize civic service management by providing a centralized digital solution where citizens can report public issues, request emergency assistance, and monitor service progress in real time.

Unlike traditional complaint systems that rely on phone calls, emails, or social media, CivicSync offers an integrated web platform connecting citizens with government departments through location-based reporting, real-time notifications, and intelligent complaint management.

The project also includes an emergency response module that enables users to instantly send SOS requests with live location sharing, allowing responsible departments to respond more efficiently.

---

# 🎯 Objectives

The primary objectives of CivicSync are:

- Digitize civic complaint management.
- Improve transparency in public service delivery.
- Reduce complaint processing time.
- Eliminate duplicate complaint submissions.
- Improve communication between citizens and government authorities.
- Provide a centralized emergency response platform.
- Increase accountability through real-time complaint tracking.
- Build a scalable Smart City service platform.

---

# ❗ Problem Statement

Citizens frequently experience problems such as damaged roads, water leakage, broken streetlights, overflowing garbage, drainage blockage, and other civic issues.

Currently, these issues are mostly reported through:

- Phone calls
- Facebook pages
- Messenger
- Emails
- Physical office visits

These traditional methods have several limitations:

- No centralized reporting platform
- Lack of transparency
- Delayed response
- Duplicate complaints
- No real-time tracking
- Poor communication between citizens and departments

Similarly, during emergencies, people often struggle to quickly contact the appropriate emergency service while sharing their exact location.

---

# 💡 Proposed Solution

CivicSync provides a centralized Smart Government platform where citizens can:

- Report civic issues using GPS location
- Upload photos and videos as evidence
- Track complaint progress in real time
- Receive instant status updates
- Verify completed work
- Submit emergency SOS requests
- Share live location during emergencies
- Locate nearby hospitals, police stations, and fire stations

On the government side, responsible departments receive complaints through dedicated dashboards where officers can manage, monitor, and resolve issues efficiently.

---

# ✨ Core Modules

## 🏙️ Civic Service Module

- Secure Authentication
- GPS-Based Complaint Reporting
- Image & Video Upload
- AI-Assisted Complaint Classification
- Duplicate Complaint Detection
- Interactive City Map
- Complaint Tracking
- Before & After Verification
- Community Verification
- Service Rating

---

## 🚨 Emergency Response Module

- One-Tap SOS
- Live Location Sharing
- Emergency Contact Notification
- Nearby Police Station Finder
- Nearby Hospital Finder
- Nearby Fire Service Finder
- Emergency Incident Tracking
- Emergency Status Updates

---

## 🏛 Government Management Module

- Department Dashboard
- Complaint Assignment
- Complaint Verification
- Complaint Monitoring
- Complaint Status Management
- Department Performance Analytics
- Report Generation

---

## ⚙️ System Administration Module

- User Management
- Department Management
- Role & Permission Management
- Analytics Dashboard
- Activity Logs
- System Configuration

---

# 👥 User Roles

## 👤 Citizen

The Citizen is the primary user of the platform.

### Responsibilities

- Register/Login
- Manage Profile
- Submit Civic Complaints
- Upload Images & Videos
- Share GPS Location
- Track Complaint Status
- Verify Completed Work
- Rate Government Services
- Community Verification
- Submit Emergency SOS
- View Nearby Emergency Services

---

## 🖥️ System Administrator

Responsible for managing the overall platform.

### Responsibilities

- Manage Users
- Manage Departments
- Configure System Settings
- Manage Roles & Permissions
- View System Analytics
- Monitor Platform Activity
- Maintain Security
- Generate Reports

---

## 🏢 Department Head

Responsible for supervising an individual government department.

### Responsibilities

- Review Complaints
- Verify Complaint Authenticity
- Set Priority Level
- Assign Department Officers
- Monitor Complaint Progress
- Approve Completed Work
- Generate Department Reports

---

## 👨‍💼 Department Officer

Responsible for managing assigned complaints.

### Responsibilities

- Receive Assigned Complaints
- Inspect Reported Issues
- Coordinate Field Operations
- Update Complaint Status
- Communicate with Citizens
- Submit Completion Reports

---

## 👷 Field Worker / Engineer

Responsible for resolving civic issues in the field.

### Responsibilities

- Receive Assigned Tasks
- Navigate Using GPS
- Perform Field Work
- Upload Before & After Images
- Submit Completion Notes
- Mark Tasks as Completed

---

# 🏛 Government Departments

The platform supports multiple government departments, including:

- Road & Highway Department
- Waste Management Department
- Drainage Department
- Water Supply Department
- Street Lighting Department
- Parks & Environment Department
- Public Health Department
- Police Department
- Fire Service & Civil Defence
- Ambulance Service
- Disaster Management Department

---

# 🛠️ Technology Stack

## 🎨 Frontend

- React.js
- React Router DOM
- Tailwind CSS
- Axios
- Socket.io Client
- React Hook Form

---

## ⚙️ Backend

- Node.js
- Express.js
- Socket.io
- JWT Authentication
- bcrypt
- Multer

---

## 🗄️ Database

- MongoDB
- Mongoose ODM

---

## ☁️ Cloud Services

- Cloudinary

---

## 📍 Maps & Location

- Google Maps API / OpenStreetMap
- Browser Geolocation API

---

## 🤖 AI Services

- Complaint Classification
- Duplicate Complaint Detection
- Priority Suggestion
- Emergency Detection
- Complaint Summarization

> **Note:** AI provides intelligent suggestions only. Final decisions are always made by authorized government officials.

---

## 🔐 Security

- JWT Authentication
- Role-Based Access Control (RBAC)
- Password Hashing (bcrypt)
- Protected API Routes

---

# 🏗️ System Architecture

```
                            Citizen
                                │
                                ▼
                     React Frontend (Client)
                                │
                  REST API + Real-Time Socket
                                │
                                ▼
                   Node.js + Express Server
        ┌───────────────┼─────────────────┬────────────────┐
        │               │                 │                │
        ▼               ▼                 ▼                ▼
    MongoDB        Cloudinary      Socket.io        AI Engine
        │               │                 │                │
        └───────────────┴─────────────────┴────────────────┘
                                │
                                ▼
                    Government Management System
```

---

# 🏛️ Government Complaint Workflow

```
Citizen

        │

        ▼

Submit Complaint

        │

        ▼

AI Analysis
(Category + Duplicate Detection + Priority Suggestion)

        │

        ▼

Department Head Review

        │

        ▼

Assign Department Officer

        │

        ▼

Assign Field Worker

        │

        ▼

Field Work Completed

        │

        ▼

Officer Verification

        │

        ▼

Department Head Approval

        │

        ▼

Citizen Feedback

        │

        ▼

Complaint Closed
```

---

# 🚨 Emergency Response Workflow

```
Citizen

        │

        ▼

Press SOS Button

        │

        ▼

Live Location Shared

        │

        ▼

AI Detects Emergency Type (Optional)

        │

        ▼

Nearest Emergency Department

        │

        ▼

Department Officer

        │

        ▼

Emergency Response Team

        │

        ▼

Rescue Completed

        │

        ▼

Emergency Closed
```

---

# 📋 Complaint Status

```
Pending
    │
    ▼
Verified
    │
    ▼
Assigned
    │
    ▼
In Progress
    │
    ▼
Under Review
    │
    ▼
Completed
    │
    ▼
Closed
```

---

# 📊 Dashboard Overview

## 👤 Citizen Dashboard

- My Complaints
- Complaint Tracking
- SOS Requests
- Notifications
- Service Ratings
- Nearby Emergency Services
- Profile Management

---

## 🏢 Department Dashboard

- Assigned Complaints
- Complaint Queue
- Field Task Management
- Emergency Requests
- Complaint Analytics
- Performance Statistics

---

## ⚙️ Administrator Dashboard

- User Management
- Department Management
- Role Management
- System Monitoring
- Analytics Dashboard
- Activity Logs
- Report Generation

---

# 📁 Project Structure

```
CivicSync/
│
├── client/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── hooks/
│   │   ├── context/
│   │   ├── services/
│   │   └── utils/
│   │
│   └── package.json
│
├── server/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── socket/
│   ├── utils/
│   └── server.js
│
├── README.md
├── package.json
└── .env
```

---

# 🚀 Installation

## Clone Repository

```bash
git clone https://github.com/yourusername/CivicSync.git
```

## Install Dependencies

### Frontend

```bash
cd client
npm install
```

### Backend

```bash
cd server
npm install
```

---

# ⚙️ Environment Variables

```env
PORT=5000

MONGODB_URI=

JWT_SECRET=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

GOOGLE_MAPS_API_KEY=

OPENAI_API_KEY= (Optional)
```

---

# ▶️ Running the Project

### Start Backend

```bash
cd server
npm run dev
```

### Start Frontend

```bash
cd client
npm run dev
```

---

# 🌐 Local Development

| Service | URL |
|----------|------------------------|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:5000 |
| MongoDB | Atlas / Local Instance |


---

# 🗃️ Database Collections

The system is designed using MongoDB with the following core collections:

### 👤 Users
Stores all registered users with role-based access.

**Fields**
- Name
- Email
- Password (Hashed)
- Phone Number
- Role
- Department
- Profile Image
- Status
- Created At

---

### 🏛 Departments

Stores all government departments.

**Examples**

- Road & Highway Department
- Waste Management Department
- Water Supply Department
- Drainage Department
- Street Lighting Department
- Parks & Environment Department
- Public Health Department
- Police Department
- Fire Service & Civil Defence
- Ambulance Service
- Disaster Management Department

---

### 📄 Complaints

Stores all civic issue reports.

**Fields**

- Complaint ID
- Citizen ID
- Department ID
- Assigned Officer
- Assigned Field Worker
- Category
- Title
- Description
- Images
- GPS Location
- Priority
- Status
- AI Suggestions
- Before Images
- After Images
- Citizen Feedback
- Created At
- Updated At

---

### 🚨 Emergency Requests

Stores emergency SOS requests.

**Fields**

- User ID
- Emergency Type
- Live Location
- Assigned Department
- Assigned Officer
- Status
- Response Time
- Created At

---

# 🔐 Security Features

- JWT Authentication
- Password Hashing (bcrypt)
- Protected API Routes
- Role-Based Access Control (RBAC)
- Secure Image Upload
- Input Validation
- Environment Variables
- API Authorization
- Secure Password Storage

---

# 📡 Major System Features

## Citizen Portal

- User Registration & Login
- Submit Civic Complaints
- GPS-Based Reporting
- Upload Images & Videos
- Complaint Tracking
- Emergency SOS
- Live Location Sharing
- Community Verification
- Service Rating

---

## Government Portal

- Department Dashboard
- Complaint Management
- Officer Assignment
- Field Task Monitoring
- Complaint Verification
- Complaint Analytics
- Emergency Monitoring
- Department Reports

---

## AI Assistance

The AI module works as an intelligent assistant to support government officers.

### AI Capabilities

- Complaint Classification
- Duplicate Complaint Detection
- Priority Recommendation
- Emergency Detection
- Complaint Summary Generation

> **Note:** AI only provides recommendations. Final decisions are made by authorized government officials.

---

# 📱 Future Enhancements

- Progressive Web App (PWA)
- Android & iOS Mobile Application
- Push Notifications
- SMS & Email Alerts
- AI Chatbot Assistant
- Voice-Based Complaint Submission
- Multi-Language Support
- Predictive Analytics
- IoT Sensor Integration
- Government API Integration
- Digital Signature Verification

---

# 📸 Screenshots

Screenshots will be added after project implementation.

### Planned Screens

- Landing Page
- Authentication
- Citizen Dashboard
- Complaint Details
- SOS Module
- Department Dashboard
- Admin Dashboard
- Analytics Dashboard

---

# 👨‍💻 Team

## Dark Coders

### Members

| Name | Student ID |
|------|------------|
| Sabbir Ahamed Shaon Akanda | 0112330640 |
| Md. Rahatul Islam | 0112330958 |
| Md. Al-Amin Islam Shawon | 0112330959 |

---

## Course Information

**Course**

Software Engineering Laboratory

**Department**

Department of Computer Science & Engineering (CSE)

**University**

United International University (UIU)

---

# 📚 References

The following platforms and government services were studied during the requirement analysis phase:

- FixMyStreet
- SeeClickFix
- Bangladesh Grievance Redress System (GRS)
- National Emergency Service (999)
- RapidSOS
- NYC 311 Service Portal

---

# 📄 License

This project has been developed as part of the **Software Engineering Laboratory** course at **United International University (UIU)**.

The project is intended solely for **academic, research, and educational purposes**.

---

# 🙏 Acknowledgements

We sincerely thank our course instructor for continuous guidance and valuable feedback throughout the project development process.

Special thanks to:

- Department of Computer Science & Engineering, UIU
- Open Source Community
- Google Maps Platform
- MongoDB
- React.js
- Node.js
- Express.js
- Cloudinary

---

# ⭐ Project Status

> **Current Version:** v1.0 (Development Phase)

### Current Progress

- ✅ Requirement Analysis
- ✅ Software Requirement Specification (SRS)
- ✅ System Design
- 🔄 UI/UX Design
- 🔄 Backend Development
- ⏳ AI Module Integration
- ⏳ Testing
- ⏳ Deployment

---

## 🚀 CivicSync

**Empowering Citizens. Strengthening Governance. Building Smarter Communities.**

---

Made with ❤️ by **Dark Coders**
