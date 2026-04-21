# Workgroup Module API Endpoints

**Base URL:** `https://rms.rushcorporation.com`

**Global Headers Required:**
- `Authorization`: `Bearer <your-token>`
- `Content-Type`: `application/json` *(Exceptions are marked where `multipart/form-data` is required for file uploads)*

---

## 1. Core Workgroup Routes

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `https://rms.rushcorporation.com/api/workgroups` | Get a list of all workgroups. |
| **POST** | `https://rms.rushcorporation.com/api/workgroups` | Create a new workgroup. |
| **POST** | `https://rms.rushcorporation.com/api/workgroups/direct-chat` | Get or create a direct chat workgroup. |
| **GET** | `https://rms.rushcorporation.com/api/workgroups/:id` | Get details of a specific workgroup. |
| **PUT** | `https://rms.rushcorporation.com/api/workgroups/:id` | Update a specific workgroup. |
| **DELETE** | `https://rms.rushcorporation.com/api/workgroups/:id` | Delete a specific workgroup. |

---

## 2. Workgroup Members

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `https://rms.rushcorporation.com/api/workgroups/:id/members` | Get a list of members in a workgroup. |
| **POST** | `https://rms.rushcorporation.com/api/workgroups/:id/members` | Add a new member to a workgroup. |
| **DELETE** | `https://rms.rushcorporation.com/api/workgroups/:id/members/:memberId` | Remove a member from a workgroup. |

---

## 3. Workgroup Posts / Messages

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `https://rms.rushcorporation.com/api/workgroups/:id/posts` | Get posts/messages within a workgroup. |
| **POST** | `https://rms.rushcorporation.com/api/workgroups/:id/posts` | Create a new post/message in a workgroup. |
| **DELETE** | `https://rms.rushcorporation.com/api/workgroups/:id/posts/:postId` | Delete a specific post (for everyone). |
| **DELETE** | `https://rms.rushcorporation.com/api/workgroups/:id/posts/:postId/me` | Delete a post only for the current user. |
| **PUT** | `https://rms.rushcorporation.com/api/workgroups/:id/posts/:postId/pin` | Toggle pin/unpin status of a post. |
| **POST** | `https://rms.rushcorporation.com/api/workgroups/:id/posts/:postId/reactions`| Add/toggle a reaction on a post. |

---

## 4. Workgroup Activities

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `https://rms.rushcorporation.com/api/workgroups/:id/activities` | Get the activity log/history for a workgroup. |

---

## 5. Workgroup Files & Avatars

| Method | Endpoint | Description | Special Headers |
| :--- | :--- | :--- | :--- |
| **GET** | `https://rms.rushcorporation.com/api/workgroups/:workgroupId/files` | Get all files in a workgroup. | |
| **POST** | `https://rms.rushcorporation.com/api/workgroups/:workgroupId/files` | Upload a file to a workgroup. | `Content-Type: multipart/form-data` |
| **POST** | `https://rms.rushcorporation.com/api/workgroups/:workgroupId/avatar` | Upload an avatar for the workgroup. | `Content-Type: multipart/form-data` |
| **GET** | `https://rms.rushcorporation.com/api/workgroups/:workgroupId/files/:fileId/view` | View a specific file in the browser. | |
| **GET** | `https://rms.rushcorporation.com/api/workgroups/:workgroupId/files/:fileId/download` | Download a specific file. | |
| **DELETE**| `https://rms.rushcorporation.com/api/workgroups/:workgroupId/files/:fileId` | Delete a file from the workgroup. | |

---

## 6. Workgroup Notifications

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `https://rms.rushcorporation.com/api/workgroups/:workgroupId/notifications` | Get notifications for a workgroup. |
| **PUT** | `https://rms.rushcorporation.com/api/workgroups/:workgroupId/notifications/:notificationId/read` | Mark a specific notification as read. |
| **PUT** | `https://rms.rushcorporation.com/api/workgroups/:workgroupId/notifications/read-all` | Mark all notifications as read. |
| **DELETE** | `https://rms.rushcorporation.com/api/workgroups/:workgroupId/notifications/:notificationId`| Delete a specific notification. |

---

## 7. Workgroup Wiki

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `https://rms.rushcorporation.com/api/workgroups/:workgroupId/wiki` | Get list of Wiki pages for a workgroup. |
| **POST** | `https://rms.rushcorporation.com/api/workgroups/:workgroupId/wiki` | Create a new Wiki page. |
| **GET** | `https://rms.rushcorporation.com/api/workgroups/:workgroupId/wiki/:pageId` | Get a specific Wiki page by ID. |
| **PUT** | `https://rms.rushcorporation.com/api/workgroups/:workgroupId/wiki/:pageId` | Update a specific Wiki page. |
| **DELETE** | `https://rms.rushcorporation.com/api/workgroups/:workgroupId/wiki/:pageId` | Delete a specific Wiki page. |
