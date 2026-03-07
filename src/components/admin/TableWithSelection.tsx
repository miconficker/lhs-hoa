import { useState } from "react";

interface TableWithSelectionProps<T> {
  data: T[];
  idField: keyof T;
  onSelectionChange: (selectedIds: string[]) => void;
  children: (props: {
    selectedIds: Set<string>;
    handleCheckboxChange: (id: string, checked: boolean) => void;
    handleSelectAll: (checked: boolean) => void;
    isAllSelected: boolean;
    isSomeSelected: boolean;
  }) => React.ReactElement;
}

export function TableWithSelection<T extends Record<string, any>>({
  data,
  idField,
  onSelectionChange,
  children,
}: TableWithSelectionProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleCheckboxChange = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
    onSelectionChange(Array.from(newSelected));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = data.map((item) => String(item[idField]));
      setSelectedIds(new Set(allIds));
      onSelectionChange(allIds);
    } else {
      setSelectedIds(new Set());
      onSelectionChange([]);
    }
  };

  const isAllSelected = data.length > 0 && selectedIds.size === data.length;
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  return (
    <>
      {children({
        selectedIds,
        handleCheckboxChange,
        handleSelectAll,
        isAllSelected,
        isSomeSelected,
      })}
    </>
  );
}
