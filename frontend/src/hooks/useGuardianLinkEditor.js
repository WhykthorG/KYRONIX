// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
import { useEffect, useMemo, useState } from 'react';

export function useGuardianLinkEditor({ editOpen, editProfileId, students, guardianLinks }) {
  const [linkedStudentIds, setLinkedStudentIds] = useState([]);

  useEffect(() => {
    if (!editOpen || !editProfileId) {
      setLinkedStudentIds([]);
      return;
    }

    setLinkedStudentIds(
      guardianLinks.map((link) => link.student_id).filter(Boolean)
    );
  }, [editOpen, editProfileId, guardianLinks]);

  const availableGuardianStudents = useMemo(() => (
    students
      .filter((student) => student?.id)
      .sort((left, right) => (
        String(left.full_name || '').localeCompare(String(right.full_name || ''), 'pt-BR')
      ))
  ), [students]);

  const toggleLinkedStudent = (studentId) => {
    setLinkedStudentIds((current) => (
      current.includes(studentId)
        ? current.filter((value) => value !== studentId)
        : [...current, studentId]
    ));
  };

  const resetLinkedStudents = () => {
    setLinkedStudentIds([]);
  };

  return {
    linkedStudentIds,
    setLinkedStudentIds,
    availableGuardianStudents,
    toggleLinkedStudent,
    resetLinkedStudents,
  };
}
