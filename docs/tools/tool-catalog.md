# VANNI Tool Catalog (Initial 16 Business Tools)

This catalog details the initial 16 guardrailed business tools available in the VANNI Action & Tool Execution Engine.

---

### 1. `find_customer`
- **Category**: `CUSTOMER`
- **Risk Level**: `LOW`
- **Confirmation Required**: `false`
- **Required Permissions**: `canAccessCustomerData`
- **Inputs**:
  - `phone` (string, required): Customer phone number.
- **Output**:
  - `found`: boolean
  - `customerId`, `name`, `phone`, `city`, `preferredLanguage`

---

### 2. `create_customer`
- **Category**: `CUSTOMER`
- **Risk Level**: `MEDIUM`
- **Confirmation Required**: `false`
- **Required Permissions**: `canCaptureLeads`
- **Inputs**:
  - `name` (string, required): Full name.
  - `phone` (string, required): Normalized phone number.
  - `email` (string, optional)
  - `city` (string, optional)
  - `preferredLanguage` (string, optional)
  - `notes` (string, optional)
- **Output**:
  - `customerId`, `status`: `CREATED` | `ALREADY_EXISTS`

---

### 3. `update_customer`
- **Category**: `CUSTOMER`
- **Risk Level**: `MEDIUM`
- **Confirmation Required**: `false`
- **Required Permissions**: `canCaptureLeads`
- **Inputs**:
  - `customerId` (string, required)
  - `name`, `email`, `city`, `preferredLanguage`, `notes` (optional)
- **Output**:
  - `customerId`, `status`: `UPDATED`

---

### 4. `create_lead`
- **Category**: `LEAD`
- **Risk Level**: `MEDIUM`
- **Confirmation Required**: `false` (Implicit)
- **Required Permissions**: `canCaptureLeads`
- **Inputs**:
  - `name` (string, required)
  - `phone` (string, required)
  - `interest` (string, required): Property requirement or clinical service.
  - `budget` (string, optional)
  - `location` (string, optional)
  - `preferredTimeline` (string, optional)
  - `source` (enum, default `PHONE`)
- **Output**:
  - `leadId`, `customerId`, `qualificationStatus`, `status`: `CREATED`

---

### 5. `update_lead`
- **Category**: `LEAD`
- **Risk Level**: `MEDIUM`
- **Confirmation Required**: `false`
- **Required Permissions**: `canCaptureLeads`
- **Inputs**:
  - `leadId` (string, required)
  - `interest`, `budget`, `location`, `notes`, `stage` (optional)
- **Output**:
  - `leadId`, `updated`: `true`

---

### 6. `qualify_lead`
- **Category**: `LEAD`
- **Risk Level**: `MEDIUM`
- **Confirmation Required**: `false`
- **Required Permissions**: `canCaptureLeads`
- **Inputs**:
  - `leadId` (string, required)
  - `budgetConfirmed` (boolean)
  - `timelineConfirmed` (boolean)
  - `siteVisitOrConsultationRequested` (boolean)
- **Output**:
  - `leadId`, `qualificationStatus`, `score`

---

### 7. `check_availability`
- **Category**: `APPOINTMENT`
- **Risk Level**: `LOW`
- **Confirmation Required**: `false`
- **Required Permissions**: `canBookAppointments`
- **Inputs**:
  - `date` (string, required): Expression like "tomorrow", "ivattu", or ISO date.
  - `serviceId` (string, optional)
  - `staffId` (string, optional)
- **Output**:
  - `date`, `timezone`, `hasAvailability`, `availableSlots`: array of slot strings.

---

### 8. `create_appointment`
- **Category**: `APPOINTMENT`
- **Risk Level**: `HIGH`
- **Confirmation Required**: `true` (Explicit)
- **Required Permissions**: `canBookAppointments`
- **Inputs**:
  - `name` (string, required)
  - `phone` (string, required)
  - `date` (string, required)
  - `time` (string, required)
  - `serviceId` (string, optional)
  - `staffId` (string, optional)
- **Output**:
  - `appointmentId`, `startTime`, `endTime`, `timezone`, `status`: `CONFIRMED`

---

### 9. `reschedule_appointment`
- **Category**: `APPOINTMENT`
- **Risk Level**: `HIGH`
- **Confirmation Required**: `true` (Explicit)
- **Required Permissions**: `canBookAppointments`
- **Inputs**:
  - `appointmentId` (string, required)
  - `newDate` (string, required)
  - `newTime` (string, required)
- **Output**:
  - `appointmentId`, `startTime`, `status`: `RESCHEDULED`

---

### 10. `cancel_appointment`
- **Category**: `APPOINTMENT`
- **Risk Level**: `HIGH`
- **Confirmation Required**: `true` (Explicit)
- **Required Permissions**: `canBookAppointments`
- **Inputs**:
  - `appointmentId` (string, required)
  - `reason` (string, optional)
- **Output**:
  - `appointmentId`, `status`: `CANCELLED`

---

### 11. `create_callback_request`
- **Category**: `COMMUNICATION`
- **Risk Level**: `MEDIUM`
- **Confirmation Required**: `false` (Implicit)
- **Required Permissions**: `canCaptureLeads`
- **Inputs**:
  - `name`, `phone`, `preferredTime`, `reason`
- **Output**:
  - `callbackId`, `status`: `REQUESTED`

---

### 12. `request_human_handoff`
- **Category**: `TRANSFER`
- **Risk Level**: `HIGH`
- **Confirmation Required**: `false`
- **Required Permissions**: `canTransferCalls`
- **Inputs**:
  - `reason`, `priority`, `targetDepartment`
- **Output**:
  - `transferInitiated`: `true`, `status`: `HANDOFF_REQUESTED`

---

### 13. `create_follow_up`
- **Category**: `FOLLOW_UP`
- **Risk Level**: `MEDIUM`
- **Confirmation Required**: `false`
- **Required Permissions**: `canCaptureLeads`
- **Inputs**:
  - `customerId`, `title`, `dueDate`, `priority`
- **Output**:
  - `taskId`, `status`: `PENDING`

---

### 14. `get_business_hours`
- **Category**: `INFORMATION`
- **Risk Level**: `LOW`
- **Confirmation Required**: `false`
- **Inputs**: `dayOfWeek` (optional)
- **Output**: `regularHours`, `sunday`, `holidays`

---

### 15. `get_business_services`
- **Category**: `INFORMATION`
- **Risk Level**: `LOW`
- **Confirmation Required**: `false`
- **Inputs**: `category` (optional)
- **Output**: `services` (array of service objects)

---

### 16. `get_business_location`
- **Category**: `INFORMATION`
- **Risk Level**: `LOW`
- **Confirmation Required**: `false`
- **Inputs**: `branch` (optional)
- **Output**: `address`, `city`, `landmark`, `parkingAvailable`
