# ByteSoft LMS - Five Feature Implementation Guide

**Status**: 🚀 Ready for Implementation  
**Version**: 1.0.0  
**Date**: November 19, 2025

---

## Executive Overview

This guide provides a complete implementation roadmap for five interconnected features that transform ByteSoft into a comprehensive Learning Management System:

1. **Student Dashboard & CBT Access** - Students access paid courses, take exams, view materials
2. **Teacher CBT Management** - Teachers manage exam questions with AI generation
3. **Teacher Exam Scheduling** - Teachers schedule exams with student notifications
4. **Teacher Scheme of Work** - Teachers organize curriculum and link to exams
5. **Coordinator AI API Key Management** - Coordinator manages API key for platform-wide use

All features use **Firebase Firestore as the sole database** with comprehensive security rules.

---

## Part 1: Firestore Data Model & Schema

### Collections Overview

```
firestore/
├── courses/
│   ├── {courseId}
│   │   ├── id: string
│   │   ├── name: string
│   │   ├── description: string
│   │   ├── teacherId: string
│   │   ├── price: number
│   │   ├── category: string
│   │   ├── createdAt: timestamp
│   │   └── updatedAt: timestamp
│   │
│   └── subcollection: scheme_of_work/
│       └── {lessonId}
│           ├── id: string
│           ├── title: string
│           ├── topic: string
│           ├── description: string
│           ├── duration: number (minutes)
│           ├── timeline: date
│           └── createdAt: timestamp
│
├── student_enrollments/
│   └── {enrollmentId}
│       ├── id: string
│       ├── studentId: string
│       ├── courseId: string
│       ├── paymentStatus: 'paid' | 'pending' | 'failed'
│       ├── amount: number
│       ├── enrolledAt: timestamp
│       ├── paidAt: timestamp
│       └── expiresAt: timestamp (optional)
│
├── cbt_questions/
│   └── {questionId}
│       ├── id: string
│       ├── courseId: string
│       ├── teacherId: string
│       ├── topic: string (links to scheme_of_work topic)
│       ├── questionNumber: number (auto-renumbered)
│       ├── questionType: 'multiple_choice' | 'true_false' | 'essay'
│       ├── questionText: string
│       ├── options: string[] (for multiple choice)
│       ├── correctAnswer: string | number
│       ├── explanation: string
│       ├── aiGenerated: boolean
│       ├── createdAt: timestamp
│       └── updatedAt: timestamp
│
├── cbt_exams/
│   └── {examId}
│       ├── id: string
│       ├── courseId: string
│       ├── teacherId: string
│       ├── title: string
│       ├── description: string
│       ├── scheduledAt: timestamp
│       ├── duration: number (minutes)
│       ├── totalQuestions: number
│       ├── questionIds: string[]
│       ├── passingScore: number (%)
│       ├── status: 'scheduled' | 'ongoing' | 'completed'
│       ├── createdAt: timestamp
│       └── updatedAt: timestamp
│
├── exam_attempts/
│   └── {attemptId}
│       ├── id: string
│       ├── examId: string
│       ├── studentId: string
│       ├── courseId: string
│       ├── startedAt: timestamp
│       ├── completedAt: timestamp
│       ├── score: number
│       ├── percentage: number
│       ├── passed: boolean
│       ├── answers: {
│       │   questionId: string | number | boolean
│       │ }
│       └── autoMarked: boolean
│
├── notifications/
│   └── {notificationId}
│       ├── id: string
│       ├── userId: string (student or teacher)
│       ├── type: 'exam_scheduled' | 'exam_started' | 'lesson_added' | 'exam_result'
│       ├── title: string
│       ├── message: string
│       ├── relatedId: string (examId, lessonId, etc)
│       ├── read: boolean
│       ├── createdAt: timestamp
│       └── expiresAt: timestamp
│
├── ai_api_keys/
│   └── {coordinatorId}
│       ├── id: string
│       ├── coordinatorId: string
│       ├── apiKey: string (encrypted)
│       ├── provider: string ('openai' | 'cohere' | 'huggingface')
│       ├── isVerified: boolean
│       ├── isActive: boolean
│       ├── lastVerifiedAt: timestamp
│       ├── createdAt: timestamp
│       └── updatedAt: timestamp
│
└── system_settings/
    └── general
        ├── platformName: string
        ├── notificationEnabled: boolean
        ├── maintenanceMode: boolean
        └── updatedAt: timestamp
```

---

## Part 2: Firestore Rules Updates

### Add to firestore.rules

```plaintext
// ============================================================================
// STUDENT DASHBOARD & CBT ACCESS RULES
// ============================================================================

// Students can read only their enrolled courses and related CBT data
match /courses/{courseId} {
  allow read: if isStudent() && 
    exists(/databases/$(database)/documents/student_enrollments/$(request.auth.uid)_$(courseId));
  
  allow read: if isTeacher() && resource.data.teacherId == request.auth.uid;
  allow write: if isTeacher() && resource.data.teacherId == request.auth.uid;
  allow delete: if isAdmin();
  
  // Scheme of Work - subcollection
  match /scheme_of_work/{lessonId} {
    allow read: if isStudent() && 
      exists(/databases/$(database)/documents/student_enrollments/$(request.auth.uid)_$(resource.data.courseId));
    allow read: if isTeacher() && get(/databases/$(database)/documents/courses/$(courseId)).data.teacherId == request.auth.uid;
    allow write: if isTeacher() && get(/databases/$(database)/documents/courses/$(courseId)).data.teacherId == request.auth.uid;
    allow delete: if isTeacher() && get(/databases/$(database)/documents/courses/$(courseId)).data.teacherId == request.auth.uid;
  }
}

match /student_enrollments/{enrollmentId} {
  allow read: if isStudent() && 
    (enrollmentId.split('_')[0] == request.auth.uid || 
     resource.data.studentId == request.auth.uid);
  allow read: if isTeacher();
  allow read: if isCoordinator();
  allow create: if isStudent() && request.resource.data.studentId == request.auth.uid;
  allow update: if isCoordinator();
  allow delete: if isAdmin();
}

// ============================================================================
// CBT QUESTIONS & EXAMS RULES
// ============================================================================

match /cbt_questions/{questionId} {
  // Students can read questions only from courses they're enrolled in
  allow read: if isStudent() && 
    exists(/databases/$(database)/documents/student_enrollments/$(request.auth.uid)_$(resource.data.courseId));
  
  // Teachers can manage questions for their courses
  allow read, write, delete: if isTeacher() && resource.data.teacherId == request.auth.uid;
  allow create: if isTeacher();
  allow delete: if isAdmin();
}

match /cbt_exams/{examId} {
  // Students can read exams for courses they're enrolled in
  allow read: if isStudent() && 
    exists(/databases/$(database)/documents/student_enrollments/$(request.auth.uid)_$(resource.data.courseId));
  
  // Teachers can manage exams for their courses
  allow read, write, delete: if isTeacher() && resource.data.teacherId == request.auth.uid;
  allow create: if isTeacher();
  allow delete: if isAdmin();
}

match /exam_attempts/{attemptId} {
  // Students can create and read their own attempts
  allow read, create: if isStudent() && resource.data.studentId == request.auth.uid;
  allow read: if isTeacher() && 
    exists(/databases/$(database)/documents/cbt_exams/$(resource.data.examId)) &&
    get(/databases/$(database)/documents/cbt_exams/$(resource.data.examId)).data.teacherId == request.auth.uid;
  
  // Allow auto-marking service to update
  allow update: if request.auth == null || isAdmin();
}

// ============================================================================
// SCHEME OF WORK RULES
// ============================================================================

match /scheme_of_work/{lessonId} {
  allow read, write, delete: if isTeacher() && 
    exists(/databases/$(database)/documents/courses/$(resource.data.courseId)) &&
    get(/databases/$(database)/documents/courses/$(resource.data.courseId)).data.teacherId == request.auth.uid;
  
  allow read: if isStudent() && 
    exists(/databases/$(database)/documents/student_enrollments/$(request.auth.uid)_$(resource.data.courseId));
}

// ============================================================================
// NOTIFICATIONS RULES
// ============================================================================

match /notifications/{notificationId} {
  allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
  allow create: if isAdmin() || isCoordinator() || isTeacher();
  allow update: if isAuthenticated() && resource.data.userId == request.auth.uid;
  allow delete: if isAuthenticated() && resource.data.userId == request.auth.uid;
}

// ============================================================================
// AI API KEY RULES - COORDINATOR ONLY
// ============================================================================

match /ai_api_keys/{coordinatorId} {
  allow read: if isCoordinator() && request.auth.uid == coordinatorId;
  allow read: if isAdmin();
  allow write, delete: if isCoordinator() && request.auth.uid == coordinatorId;
  allow update: if isCoordinator() && request.auth.uid == coordinatorId;
}

// ============================================================================
// HELPER FUNCTIONS (Add to existing rules)
// ============================================================================

function hasValidEnrollment(studentId, courseId) {
  return exists(/databases/$(database)/documents/student_enrollments/$(studentId)_$(courseId)) &&
    get(/databases/$(database)/documents/student_enrollments/$(studentId)_$(courseId)).data.paymentStatus == 'paid';
}

function isEnrolledIn(courseId) {
  return hasValidEnrollment(request.auth.uid, courseId);
}
```

---

## Part 3: Feature-by-Feature Implementation

### Feature 1: Student Dashboard & CBT Access

#### Components to Create:
```
src/pages/StudentDashboard.tsx
src/components/student/
├── PaidCoursesTab.tsx
├── CBTTab.tsx
├── SchemeOfWorkModal.tsx
├── ExamTakingModal.tsx
├── NotificationBell.tsx
└── ExamResultsModal.tsx
```

#### Key Functions:
```typescript
// Fetch only enrolled and paid courses
fetchPaidCourses(studentId: string): Promise<Course[]>

// Fetch CBT questions for specific course
fetchCBTQuestionsForCourse(courseId: string): Promise<CBTQuestion[]>

// Submit exam attempt and trigger auto-marking
submitExamAttempt(attemptData: ExamAttempt): Promise<void>

// Fetch scheme of work for course
fetchSchemeOfWork(courseId: string): Promise<SchemeOfWork[]>

// Fetch unread notifications for student
fetchNotifications(studentId: string): Promise<Notification[]>
```

#### UI Features:
- ✅ Paid Courses tab with course cards
- ✅ CBT tab with available exams
- ✅ Red dot indicator for new/upcoming exams
- ✅ Scheme of Work button and modal
- ✅ Exam taking interface with timer
- ✅ Auto-marked results display
- ✅ Notifications bell with badge

#### Firestore Access:
```
READ: student_enrollments (filter by studentId, paymentStatus='paid')
READ: courses (filter by enrollmentId)
READ: cbt_exams (filter by courseId)
READ: cbt_questions (filter by courseId)
READ: exam_attempts (filter by studentId)
READ: scheme_of_work (filter by courseId)
READ: notifications (filter by userId)
```

---

### Feature 2: Teacher CBT Management

#### Components to Create:
```
src/components/teacher/
├── CBTManagementTab.tsx
├── QuestionPreviewModal.tsx
├── QuestionEditModal.tsx
├── AIQuestionGeneratorModal.tsx
└── QuestionListTable.tsx
```

#### Key Functions:
```typescript
// Fetch questions for teacher's courses
fetchTeacherQuestions(teacherId: string, courseId: string): Promise<CBTQuestion[]>

// Generate questions using AI API
generateQuestionsWithAI(
  courseId: string,
  topic: string,
  numberOfQuestions: number,
  apiKey: string
): Promise<CBTQuestion[]>

// Update question and auto-renumber
updateQuestion(questionId: string, updates: Partial<CBTQuestion>): Promise<void>

// Delete question and auto-renumber remaining questions
deleteQuestion(questionId: string): Promise<void>

// Search questions by topic or text
searchQuestions(teacherId: string, query: string): Promise<CBTQuestion[]>

// Auto-renumber questions sequentially
autoRenumberQuestions(courseId: string): Promise<void>
```

#### UI Features:
- ✅ Question preview in table format
- ✅ Edit/Remove buttons with confirmation
- ✅ Auto-renumbering after deletions
- ✅ AI question generator modal
- ✅ Search and filter by topic
- ✅ Modal confirmations for destructive actions
- ✅ Smooth transitions and loading states

#### Firestore Access:
```
READ: cbt_questions (filter by teacherId)
WRITE: cbt_questions (create, update, delete)
READ: courses (filter by teacherId)
READ: ai_api_keys (coordinator's verified key)
```

---

### Feature 3: Teacher Exam Scheduling

#### Components to Create:
```
src/components/teacher/
├── ExamSchedulingModal.tsx
├── DateTimePickerComponent.tsx
└── ScheduledExamsTable.tsx
```

#### Key Functions:
```typescript
// Validate 1-hour minimum lead time
validateExamScheduleTime(scheduledAt: Date): boolean

// Schedule exam and create notifications
scheduleExam(examData: CBTExam): Promise<void>

// Send notifications to all enrolled students
sendExamNotifications(examId: string, enrolledStudentIds: string[]): Promise<void>

// Fetch scheduled exams for course
fetchScheduledExams(courseId: string): Promise<CBTExam[]>

// Check for upcoming exams (for red dot indicator)
fetchUpcomingExams(courseId: string): Promise<CBTExam[]>
```

#### UI Features:
- ✅ Schedule Exam button opens modal
- ✅ Date & time picker with validation
- ✅ 1-hour minimum validation with error message
- ✅ Exam duration selector
- ✅ Confirmation dialog before saving
- ✅ Red dot indicator for new/upcoming exams
- ✅ Scheduled exams list with status

#### Firestore Access:
```
WRITE: cbt_exams (create, update)
READ: student_enrollments (get enrolled students)
CREATE: notifications (for each enrolled student)
READ: cbt_exams (fetch scheduled exams)
```

---

### Feature 4: Teacher Scheme of Work

#### Components to Create:
```
src/components/teacher/
├── SchemeOfWorkTab.tsx
├── LessonInputForm.tsx
├── LessonPreviewCard.tsx
├── LessonEditModal.tsx
└── LessonDeleteConfirm.tsx
```

#### Key Functions:
```typescript
// Fetch scheme of work for course
fetchSchemeOfWork(courseId: string): Promise<SchemeOfWork[]>

// Create lesson and link to CBT topics
createLesson(lessonData: SchemeOfWork): Promise<void>

// Update lesson
updateLesson(lessonId: string, updates: Partial<SchemeOfWork>): Promise<void>

// Delete lesson
deleteLesson(lessonId: string): Promise<void>

// Link lesson topics to CBT questions
linkTopicToQuestions(topic: string, courseId: string): Promise<CBTQuestion[]>

// Fetch suggested CBT questions for topic
fetchQuestionsForTopic(courseId: string, topic: string): Promise<CBTQuestion[]>
```

#### UI Features:
- ✅ Input form for lesson: title, topic, description, timeline
- ✅ Preview cards showing all lessons
- ✅ Edit button opens modal with form pre-filled
- ✅ Delete button with confirmation
- ✅ Timeline visualization
- ✅ Topic-to-CBT link indicator
- ✅ Smooth animations and transitions

#### Firestore Access:
```
READ/WRITE/DELETE: scheme_of_work (for teacher's courses)
READ: courses (filter by teacherId)
READ: cbt_questions (to link topics)
```

---

### Feature 5: Coordinator AI API Key Management

#### Components to Create:
```
src/components/coordinator/
├── AIAPIKeyTab.tsx
├── APIKeyInputForm.tsx
├── APIKeyStatusIndicator.tsx
└── APIKeyVerificationResult.tsx
```

#### Key Functions:
```typescript
// Get stored API key for coordinator
getAPIKey(coordinatorId: string): Promise<APIKeyData | null>

// Verify API key with provider
verifyAPIKey(apiKey: string, provider: string): Promise<boolean>

// Save verified API key
saveAPIKey(apiKey: string, provider: string, coordinatorId: string): Promise<void>

// Activate API key for platform
activateAPIKey(coordinatorId: string): Promise<void>

// Revoke API key
revokeAPIKey(coordinatorId: string): Promise<void>

// Get active API key (for AI services to use)
getActiveAPIKey(): Promise<string | null>
```

#### UI Features:
- ✅ Input field for API key with password mask
- ✅ Provider dropdown (OpenAI, Cohere, HuggingFace)
- ✅ Verify button triggers validation
- ✅ Status indicator: Verified ✓ / Invalid ✗
- ✅ Error messages for invalid keys
- ✅ Auto-save verified key
- ✅ Activate/Deactivate toggle
- ✅ Last verified timestamp
- ✅ Loading states during verification

#### Firestore Access:
```
READ/WRITE: ai_api_keys (coordinator only)
READ: system_settings (optional, for provider config)
```

---

## Part 4: Service Files to Create

### 1. AI Integration Service
**File**: `src/lib/aiQuestionService.ts`

```typescript
interface AIQuestionRequest {
  topic: string;
  numberOfQuestions: number;
  difficulty: 'easy' | 'medium' | 'hard';
  courseId: string;
  teacherId: string;
}

interface GeneratedQuestion {
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  topic: string;
}

export const generateQuestionsWithAI = async (
  request: AIQuestionRequest,
  apiKey: string
): Promise<GeneratedQuestion[]> => {
  // Call AI API
  // Parse response
  // Return formatted questions
}

export const verifyAPIKey = async (
  apiKey: string,
  provider: string
): Promise<boolean> => {
  // Test API key with simple request
  // Return true if valid, false if invalid
}

export const autoMarkExam = async (
  examId: string,
  studentAnswers: Record<string, any>,
  apiKey: string
): Promise<{ score: number; percentage: number }> => {
  // For objective questions: auto-mark
  // For essay questions: use AI for grading (optional)
  // Return score
}
```

### 2. Notification Service
**File**: `src/lib/notificationService.ts`

```typescript
export const sendExamNotification = async (
  studentIds: string[],
  examId: string,
  examTitle: string,
  scheduledAt: Date
): Promise<void> => {
  // Create notification for each student
  // Store in notifications collection
  // Trigger real-time update
}

export const getUnreadNotifications = async (
  userId: string
): Promise<Notification[]> => {
  // Fetch notifications where read=false
  // Sort by createdAt DESC
}

export const markNotificationAsRead = async (
  notificationId: string
): Promise<void> => {
  // Update notification.read = true
}

export const hasUnreadExamNotifications = async (
  userId: string
): Promise<boolean> => {
  // Check for unread exam_scheduled notifications
  // Return true if any exist
}
```

### 3. Enrollment & Course Service
**File**: `src/lib/enrollmentService.ts`

```typescript
export const getPaidCourses = async (
  studentId: string
): Promise<Course[]> => {
  // Query student_enrollments where studentId and paymentStatus='paid'
  // Join with courses collection
  // Return course data
}

export const checkEnrollment = async (
  studentId: string,
  courseId: string
): Promise<boolean> => {
  // Check if enrollment exists and is paid
}

export const getEnrolledStudents = async (
  courseId: string
): Promise<string[]> => {
  // Get all studentIds for a course (paid enrollments)
}
```

### 4. CBT Service
**File**: `src/lib/cbtService.ts`

```typescript
export const getQuestionsForExam = async (
  examId: string
): Promise<CBTQuestion[]> => {
  // Fetch exam
  // Get questionIds from exam
  // Fetch all questions
}

export const submitExamAttempt = async (
  attemptData: ExamAttempt
): Promise<void> => {
  // Save attempt to Firestore
  // Trigger auto-marking
  // Update student notification
}

export const autoRenumberQuestions = async (
  courseId: string
): Promise<void> => {
  // Fetch all questions for course
  // Re-number sequentially
  // Update all in batch
}
```

---

## Part 5: Deployment & Testing Plan

### Pre-Deployment Checklist

**Firestore Setup**:
- [ ] Update firestore.rules with all new rules
- [ ] Deploy rules: `firebase deploy --only firestore:rules`
- [ ] Create all new collections (Firebase will auto-create on first write)

**AI Integration**:
- [ ] Obtain API key from AI provider (OpenAI recommended)
- [ ] Test API key with verification function
- [ ] Store encrypted in Firestore

**Environment Variables**:
- [ ] No sensitive keys in client code
- [ ] API key managed by Coordinator in Firestore only
- [ ] Server-side validation of API calls (Cloud Functions recommended for production)

### Testing Checklist

**Student Dashboard Tests**:
- [ ] Student sees only paid courses
- [ ] CBT questions load only from paid courses
- [ ] Red dot appears for new exams
- [ ] Exam timer works correctly
- [ ] Auto-marking calculates scores
- [ ] Results display correctly
- [ ] Notifications bell shows unread count

**Teacher CBT Tests**:
- [ ] Teacher sees only assigned courses
- [ ] AI question generation works
- [ ] Questions auto-renumber after deletion
- [ ] Search and filter work
- [ ] Edit modal saves changes
- [ ] No permission errors

**Exam Scheduling Tests**:
- [ ] 1-hour validation works
- [ ] Notifications sent to enrolled students
- [ ] Red dot appears for new exams
- [ ] Students receive notifications
- [ ] Exam status updates correctly

**Scheme of Work Tests**:
- [ ] Teacher can create/edit/delete lessons
- [ ] Topics link to CBT questions
- [ ] Students see lessons for enrolled courses
- [ ] Timeline displays correctly

**API Key Management Tests**:
- [ ] Coordinator can input API key
- [ ] Verification button tests key
- [ ] Status indicator updates
- [ ] Key is encrypted in Firestore
- [ ] Only coordinator can access own key
- [ ] Teachers cannot access AI key management

---

## Part 6: Implementation Priority & Sequence

### Phase 1 (Weeks 1-2): Foundation
1. Update Firestore rules
2. Create service files (AI, Enrollment, CBT, Notification)
3. Implement data models

### Phase 2 (Weeks 3-4): Coordinator Tools
1. AI API Key Management tab
2. Verify API integration

### Phase 3 (Weeks 5-6): Teacher Features
1. Scheme of Work tab
2. CBT Management tab
3. Exam Scheduling

### Phase 4 (Weeks 7-8): Student Features
1. Student Dashboard
2. Paid Courses tab
3. CBT taking interface
4. Notifications system

### Phase 5 (Weeks 9-10): Testing & Refinement
1. UAT with test users
2. Performance optimization
3. Security audit
4. Bug fixes

---

## Part 7: Key Decisions & Rationale

### Why Firestore?
- Real-time data synchronization for notifications
- Built-in security rules for access control
- Scalable for growing user base
- No server setup required

### Why Client-Side Exam Grading for Objectives?
- Instant feedback for students
- Reduced server load
- Better UX (no waiting for results)
- AI used for essay grading only (optional, can be added later)

### Why Red Dot Indicators?
- Quick visual feedback
- Mobile-friendly
- Reduces need to open every section
- Standard UX pattern

### Why 1-Hour Minimum for Exams?
- Allows teacher time to prepare
- Prevents same-day surprises for students
- Allows notification delivery
- Reduces last-minute technical issues

---

## Part 8: Security Considerations

### API Key Security
- [ ] Never send API key to client
- [ ] Encrypt key in Firestore
- [ ] Use Cloud Functions for API calls (production)
- [ ] Audit log for key usage

### Student Data Privacy
- [ ] Students see only their enrollments
- [ ] Exam answers encrypted
- [ ] Results accessible only to student + teacher
- [ ] Notifications delete after 30 days

### Teacher Authorization
- [ ] Teachers modify only assigned courses
- [ ] Cannot edit other teachers' questions
- [ ] Cannot schedule exams in others' courses

### Firestore Rules
- [ ] All rules must enforce authentication
- [ ] Field-level validation for sensitive data
- [ ] Rate limiting for exam submissions
- [ ] Audit logging for modifications

---

## Part 9: Estimated Development Effort

| Component | Complexity | Estimated Hours | Priority |
|-----------|-----------|-----------------|----------|
| Firestore Rules | High | 8 | Critical |
| AI Integration Service | High | 12 | Critical |
| Coordinator API Key Tab | Medium | 6 | High |
| Teacher Scheme of Work | Medium | 10 | High |
| Teacher CBT Management | High | 14 | High |
| Teacher Exam Scheduling | Medium | 8 | High |
| Student Dashboard | High | 16 | Critical |
| Notification Service | Medium | 10 | Medium |
| Testing & Documentation | Medium | 12 | High |
| **TOTAL** | | **96 hours (~6-8 weeks)** | |

---

## Part 10: Documentation & Support

### Documentation to Create
- [ ] Firestore collection schema reference
- [ ] API integration guide (with example API calls)
- [ ] User guides for each role (student, teacher, coordinator)
- [ ] Troubleshooting guide
- [ ] Deployment checklist

### Recommended Tools
- **Frontend**: React + TypeScript + shadcn/ui (already in place)
- **Database**: Firebase Firestore (already in place)
- **AI Provider**: OpenAI API recommended (GPT-3.5 or GPT-4)
- **Authentication**: Firebase Auth (already in place)
- **Hosting**: Firebase Hosting or Vercel

### Support & Maintenance
- Monitor Firestore read/write costs
- Review security rules monthly
- Test backup/restore procedures
- Keep API key credentials secure
- Monitor error logs in Firebase Console

---

**End of Implementation Guide**

**Next Steps**:
1. Review this guide with team
2. Update Firestore rules
3. Begin Phase 1 implementation
4. Set up development environment
5. Create test data in Firestore

---

*This guide provides a complete roadmap for implementing all five features with Firestore as the sole database. Each section includes code structure, Firebase rules, and deployment considerations.*
