import AcademicStaffExamPicker from './AcademicStaffExamPicker';

export default function AcademicStaffAttemptsHub() {
  return (
    <AcademicStaffExamPicker
      suffix="attempts"
      icon="edit"
      titleKey="View Attempts & Grading"
      descriptionKey="Pick an exam to review attempts and grade submissions."
    />
  );
}
