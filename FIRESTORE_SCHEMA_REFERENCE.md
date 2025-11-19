# Firestore Collection Structure - Complete Reference

**Version**: 1.0.0  
**Date**: November 19, 2025

---

## Collection Definitions

### 1. courses

**Path**: `/courses/{courseId}`

**Purpose**: Core course information that all features reference

**Document Structure**:
```json
{
  "id": "course_001",
  "name": "Web Development 101",
  "description": "Learn HTML, CSS, and JavaScript from scratch",
  "teacherId": "user_teacher_001",
  "price": 5000,
  "currency": "NGN",
  "category": "Technology",
  "image": "https://...",
  "totalStudents": 150,
  "rating": 4.5,
  "status": "active",
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-11-19T14:30:00Z"
}
```

**Field Types**:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Document ID, same as courseId |
| name | string | ✓ | Course title, max 200 chars |
| description | string | ✓ | Course overview, max 1000 chars |
| teacherId | string | ✓ | Foreign key to users |
| price | number | ✓ | Course price in smallest unit (kobo) |
| currency | string | ✓ | 'NGN', 'USD', etc |
| category | string | ✓ | Predefined categories |
| image | string | | Course thumbnail URL |
| totalStudents | number | | Denormalized count (update on enrollment) |
| rating | number | | Average rating (0-5) |
| status | string | ✓ | 'active', 'archived', 'draft' |
| createdAt | timestamp | ✓ | Creation timestamp |
| updatedAt | timestamp | ✓ | Last modified timestamp |

**Subcollection**: `scheme_of_work` (see below)

**Indexes**:
- Composite: `status` (Asc), `createdAt` (Desc)
- Composite: `teacherId` (Asc), `status` (Asc)
- Composite: `category` (Asc), `rating` (Desc)

---

### 2. scheme_of_work (Subcollection under courses)

**Path**: `/courses/{courseId}/scheme_of_work/{lessonId}`

**Purpose**: Organize curriculum with topics that feed into CBT questions

**Document Structure**:
```json
{
  "id": "lesson_001",
  "courseId": "course_001",
  "title": "Introduction to HTML",
  "topic": "HTML Basics",
  "description": "Learn HTML tags, attributes, and semantic markup",
  "duration": 45,
  "timeline": "2024-12-01",
  "order": 1,
  "resources": [
    {
      "type": "video",
      "url": "https://...",
      "title": "HTML Basics Tutorial"
    },
    {
      "type": "document",
      "url": "https://...",
      "title": "HTML Reference"
    }
  ],
  "createdAt": "2024-01-20T10:00:00Z",
  "updatedAt": "2024-11-19T14:30:00Z"
}
```

**Field Types**:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Document ID |
| courseId | string | ✓ | Parent course ID |
| title | string | ✓ | Lesson title (max 200 chars) |
| topic | string | ✓ | Topic for CBT linking (max 100 chars) |
| description | string | ✓ | Lesson overview (max 500 chars) |
| duration | number | | Duration in minutes |
| timeline | date | | Scheduled date |
| order | number | | Lesson sequence (1, 2, 3...) |
| resources | array | | Learning materials (video, docs, etc) |
| createdAt | timestamp | ✓ | Creation timestamp |
| updatedAt | timestamp | ✓ | Last modified timestamp |

**Indexes**:
- Composite: `courseId` (Asc), `order` (Asc)
- Composite: `courseId` (Asc), `timeline` (Asc)

---

### 3. student_enrollments

**Path**: `/student_enrollments/{enrollmentId}`

**Purpose**: Track which students have paid for which courses

**Document Structure**:
```json
{
  "id": "enroll_001",
  "studentId": "user_student_001",
  "courseId": "course_001",
  "paymentStatus": "paid",
  "transactionReference": "PAY_20241119_001",
  "amount": 5000,
  "currency": "NGN",
  "enrolledAt": "2024-11-01T08:00:00Z",
  "paidAt": "2024-11-01T08:15:00Z",
  "expiresAt": null,
  "certificateIssued": false
}
```

**Field Types**:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Document ID |
| studentId | string | ✓ | Student user ID |
| courseId | string | ✓ | Course ID |
| paymentStatus | string | ✓ | 'paid', 'pending', 'failed' |
| transactionReference | string | | Payment gateway reference |
| amount | number | ✓ | Amount paid |
| currency | string | ✓ | 'NGN', 'USD', etc |
| enrolledAt | timestamp | ✓ | Enrollment date |
| paidAt | timestamp | | Payment completion date |
| expiresAt | timestamp | | Course expiration date (optional) |
| certificateIssued | boolean | | Whether certificate was awarded |

**Indexes**:
- Composite: `studentId` (Asc), `paymentStatus` (Asc)
- Composite: `courseId` (Asc), `paymentStatus` (Asc)
- Composite: `enrolledAt` (Desc)

**Validation Rules**:
- `paymentStatus` must be 'paid' for student access to CBT
- `studentId` and `courseId` combination must be unique
- Only coordinator can update payment status

---

### 4. cbt_questions

**Path**: `/cbt_questions/{questionId}`

**Purpose**: Store exam questions with auto-renumbering and AI generation tracking

**Document Structure**:
```json
{
  "id": "q_001",
  "courseId": "course_001",
  "teacherId": "user_teacher_001",
  "topic": "HTML Basics",
  "questionNumber": 1,
  "questionType": "multiple_choice",
  "questionText": "What does HTML stand for?",
  "options": [
    "Hypertext Markup Language",
    "Home Tool Markup Language",
    "Hyperlinks and Text Markup Language",
    "Home Tags Markup Language"
  ],
  "correctAnswer": 0,
  "explanation": "HTML stands for Hypertext Markup Language, the standard markup language for creating web pages.",
  "difficulty": "easy",
  "aiGenerated": true,
  "aiModel": "gpt-3.5-turbo",
  "createdAt": "2024-11-15T10:00:00Z",
  "updatedAt": "2024-11-19T14:30:00Z"
}
```

**Field Types**:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Document ID |
| courseId | string | ✓ | Course ID |
| teacherId | string | ✓ | Teacher who created/verified |
| topic | string | ✓ | Links to scheme_of_work topic |
| questionNumber | number | ✓ | Sequential number (auto-generated) |
| questionType | string | ✓ | 'multiple_choice', 'true_false', 'essay' |
| questionText | string | ✓ | The actual question (max 500 chars) |
| options | array | ✓ | Answer options (for MC) |
| correctAnswer | string/number | ✓ | Index or value of correct answer |
| explanation | string | ✓ | Explanation of correct answer |
| difficulty | string | | 'easy', 'medium', 'hard' |
| aiGenerated | boolean | ✓ | Whether AI generated |
| aiModel | string | | Which AI model was used |
| createdAt | timestamp | ✓ | Creation timestamp |
| updatedAt | timestamp | ✓ | Last modified timestamp |

**Indexes**:
- Composite: `courseId` (Asc), `questionNumber` (Asc)
- Composite: `courseId` (Asc), `topic` (Asc)
- Composite: `teacherId` (Asc), `createdAt` (Desc)

**Special Logic**:
- Question numbers auto-renumber sequentially when any question is deleted
- Only teacher of course can create/edit/delete
- Students cannot see correct answers until after exam

---

### 5. cbt_exams

**Path**: `/cbt_exams/{examId}`

**Purpose**: Define exams to be taken by students

**Document Structure**:
```json
{
  "id": "exam_001",
  "courseId": "course_001",
  "teacherId": "user_teacher_001",
  "title": "HTML Basics Quiz",
  "description": "Test your knowledge of HTML fundamentals",
  "scheduledAt": "2024-12-10T14:00:00Z",
  "duration": 60,
  "totalQuestions": 20,
  "questionIds": ["q_001", "q_002", "q_003", ...],
  "passingScore": 50,
  "status": "scheduled",
  "showResultsImmediately": true,
  "createdAt": "2024-11-15T10:00:00Z",
  "updatedAt": "2024-11-19T14:30:00Z"
}
```

**Field Types**:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Document ID |
| courseId | string | ✓ | Course ID |
| teacherId | string | ✓ | Teacher who scheduled exam |
| title | string | ✓ | Exam name |
| description | string | | Exam description |
| scheduledAt | timestamp | ✓ | Exam start time |
| duration | number | ✓ | Duration in minutes |
| totalQuestions | number | ✓ | Number of questions |
| questionIds | array | ✓ | Array of question IDs |
| passingScore | number | ✓ | Minimum % to pass (0-100) |
| status | string | ✓ | 'scheduled', 'ongoing', 'completed' |
| showResultsImmediately | boolean | ✓ | Whether to show results after submission |
| createdAt | timestamp | ✓ | Creation timestamp |
| updatedAt | timestamp | ✓ | Last modified timestamp |

**Indexes**:
- Composite: `courseId` (Asc), `scheduledAt` (Asc)
- Composite: `teacherId` (Asc), `status` (Asc)
- Composite: `status` (Asc), `scheduledAt` (Desc)

**Validation Rules**:
- `scheduledAt` must be at least 1 hour in future
- `passingScore` must be between 0 and 100
- Cannot be edited after `scheduledAt` has passed
- Only teacher of course can create/edit

---

### 6. exam_attempts

**Path**: `/exam_attempts/{attemptId}`

**Purpose**: Record student exam submissions and auto-marked results

**Document Structure**:
```json
{
  "id": "attempt_001",
  "examId": "exam_001",
  "studentId": "user_student_001",
  "courseId": "course_001",
  "startedAt": "2024-12-10T14:00:30Z",
  "completedAt": "2024-12-10T15:00:15Z",
  "duration": 3585,
  "answers": {
    "q_001": 0,
    "q_002": "true",
    "q_003": "This is my essay answer..."
  },
  "score": 18,
  "totalQuestions": 20,
  "percentage": 90,
  "passed": true,
  "autoMarked": true,
  "markedAt": "2024-12-10T15:00:20Z"
}
```

**Field Types**:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Document ID |
| examId | string | ✓ | Exam ID |
| studentId | string | ✓ | Student user ID |
| courseId | string | ✓ | Course ID (denormalized for queries) |
| startedAt | timestamp | ✓ | When student started exam |
| completedAt | timestamp | ✓ | When student submitted |
| duration | number | ✓ | Time taken in seconds |
| answers | object | ✓ | Question ID -> Answer mapping |
| score | number | ✓ | Number of correct answers |
| totalQuestions | number | ✓ | Total questions in exam |
| percentage | number | ✓ | Score percentage (0-100) |
| passed | boolean | ✓ | Whether score >= passingScore |
| autoMarked | boolean | ✓ | Whether auto-marked (vs manual) |
| markedAt | timestamp | | When exam was marked |

**Indexes**:
- Composite: `studentId` (Asc), `completedAt` (Desc)
- Composite: `examId` (Asc), `completedAt` (Desc)
- Composite: `courseId` (Asc), `passed` (Asc)

**Security Rules**:
- Student can only read own attempts
- Teacher can read attempts of their course
- Student cannot update after submission
- Only auto-marking service can update scores

---

### 7. notifications

**Path**: `/notifications/{notificationId}`

**Purpose**: Alert students and teachers of important events

**Document Structure**:
```json
{
  "id": "notif_001",
  "userId": "user_student_001",
  "type": "exam_scheduled",
  "title": "New Exam Scheduled",
  "message": "Your teacher has scheduled 'HTML Basics Quiz' for Dec 10 at 2:00 PM",
  "relatedId": "exam_001",
  "relationType": "exam",
  "read": false,
  "createdAt": "2024-11-19T14:30:00Z",
  "expiresAt": "2024-12-20T14:30:00Z"
}
```

**Field Types**:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Document ID |
| userId | string | ✓ | User ID to receive notification |
| type | string | ✓ | 'exam_scheduled', 'lesson_added', 'exam_result', etc |
| title | string | ✓ | Notification title |
| message | string | ✓ | Notification message (max 200 chars) |
| relatedId | string | | ID of related resource (exam, lesson, etc) |
| relationType | string | | Type of related resource |
| read | boolean | ✓ | Whether user has read notification |
| createdAt | timestamp | ✓ | Creation timestamp |
| expiresAt | timestamp | | Auto-delete timestamp (optional) |

**Indexes**:
- Composite: `userId` (Asc), `read` (Asc)
- Composite: `userId` (Asc), `createdAt` (Desc)
- Composite: `createdAt` (Desc) with TTL delete

**Auto-Cleanup**:
- Notifications auto-delete 30 days after creation (use TTL)
- Or manual cleanup via Cloud Function

---

### 8. ai_api_keys

**Path**: `/ai_api_keys/{coordinatorId}`

**Purpose**: Store and manage API key for AI question generation

**Document Structure**:
```json
{
  "id": "key_001",
  "coordinatorId": "user_coordinator_001",
  "provider": "openai",
  "apiKey": "[ENCRYPTED_KEY]",
  "apiKeyLastFour": "sk-...abc123",
  "isVerified": true,
  "isActive": true,
  "lastVerifiedAt": "2024-11-19T14:30:00Z",
  "verificationError": null,
  "usageQuota": 10000,
  "usageCount": 1234,
  "createdAt": "2024-11-01T10:00:00Z",
  "updatedAt": "2024-11-19T14:30:00Z"
}
```

**Field Types**:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Document ID |
| coordinatorId | string | ✓ | Coordinator user ID |
| provider | string | ✓ | 'openai', 'cohere', 'huggingface' |
| apiKey | string | ✓ | Encrypted API key |
| apiKeyLastFour | string | ✓ | Last 4 chars for display |
| isVerified | boolean | ✓ | Whether key was validated |
| isActive | boolean | ✓ | Whether key is in use |
| lastVerifiedAt | timestamp | | Last verification timestamp |
| verificationError | string | | Error message if verification failed |
| usageQuota | number | | Monthly API call quota |
| usageCount | number | | Current month API calls used |
| createdAt | timestamp | ✓ | Creation timestamp |
| updatedAt | timestamp | ✓ | Last modified timestamp |

**Security Requirements**:
- API key MUST be encrypted before storage
- Only coordinator who owns key can read it
- Admins can read but not retrieve key value
- Never log full API key
- Rotate key monthly (best practice)

**Indexes**: None (lookup by coordinatorId only)

---

### 9. system_settings

**Path**: `/system_settings/general`

**Purpose**: Platform-wide configuration

**Document Structure**:
```json
{
  "platformName": "ByteSoft LMS",
  "notificationEnabled": true,
  "maintenanceMode": false,
  "maxExamDuration": 240,
  "minExamScheduleLeadTime": 3600,
  "aiProvider": "openai",
  "certificateTemplate": "url/to/template",
  "updatedAt": "2024-11-19T14:30:00Z"
}
```

**Field Types**:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| platformName | string | | Platform display name |
| notificationEnabled | boolean | ✓ | Enable/disable all notifications |
| maintenanceMode | boolean | ✓ | Maintenance mode flag |
| maxExamDuration | number | | Max exam length in minutes |
| minExamScheduleLeadTime | number | | Min lead time in seconds (default: 3600) |
| aiProvider | string | | Default AI provider |
| certificateTemplate | string | | URL to certificate template |
| updatedAt | timestamp | ✓ | Last modified timestamp |

**Access Control**:
- Only admins can modify
- All authenticated users can read

---

## Data Relationships

```
courses
  ├─ has_many: scheme_of_work (1:N)
  ├─ has_many: cbt_questions (1:N)
  ├─ has_many: cbt_exams (1:N)
  └─ has_many: student_enrollments (1:N)
       ├─ belongs_to: users (students)
       └─ can_access: cbt_questions, cbt_exams

cbt_exams
  ├─ has_many: cbt_questions (via questionIds array)
  └─ has_many: exam_attempts (1:N)

exam_attempts
  ├─ belongs_to: cbt_exams
  ├─ belongs_to: users (students)
  └─ references: cbt_questions (in answers object)

ai_api_keys
  └─ belongs_to: users (coordinators)

notifications
  └─ belongs_to: users
```

---

## Estimated Document Sizes

| Collection | Avg Document Size | Typical Count | Storage |
|-----------|------------------|---------------|---------|
| courses | 500B | 100 | 50KB |
| scheme_of_work | 300B | 500 | 150KB |
| student_enrollments | 200B | 5,000 | 1MB |
| cbt_questions | 800B | 2,000 | 1.6MB |
| cbt_exams | 1KB | 200 | 200KB |
| exam_attempts | 2KB | 10,000 | 20MB |
| notifications | 300B | 50,000 | 15MB |
| ai_api_keys | 400B | 5 | 2KB |
| **TOTAL** | | **~70,000 docs** | **~38MB** |

*Estimates based on small deployment (100 students, 10 teachers, 1 coordinator)*

---

## Migration Script Example

```typescript
// Add new collections to existing Firestore
const initializeNewCollections = async () => {
  const db = getFirestore();

  // Create system_settings document
  await setDoc(doc(db, 'system_settings', 'general'), {
    platformName: 'ByteSoft LMS',
    notificationEnabled: true,
    maintenanceMode: false,
    minExamScheduleLeadTime: 3600,
    updatedAt: serverTimestamp()
  });

  console.log('Collections initialized');
};
```

---

**This reference document should be used alongside the FIVE_FEATURES_IMPLEMENTATION_GUIDE.md and firestore.rules file.**
