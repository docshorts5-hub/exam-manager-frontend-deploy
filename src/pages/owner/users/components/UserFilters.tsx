import React from "react";


type Props = {
  search: string;
  onSearchChange: (value: string) => void;

};


export default function UserFilters({
  search,
  onSearchChange,

}: Props) {

  return (
    <section
      style={{
        background: "#ffffff",
        border: "1px solid rgba(15,23,42,.08)",
        borderRadius: 18,
        padding: 14,
        boxShadow: "0 8px 25px rgba(15,23,42,.04)",
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >

      <input
        type="search"
        value={search}
        onChange={(event) =>
          onSearchChange(event.target.value)
        }
        placeholder="ابحث بالاسم أو البريد أو المحافظة أو الجهة..."
        aria-label="بحث المستخدمين"
        style={{
          flex: "1 1 320px",
          minWidth: 230,
          height: 44,
          borderRadius: 12,
          border: "1px solid #dbe2ea",
          background: "#ffffff",
          color: "#1e293b",
          padding: "0 14px",
          outline: "none",
          fontFamily: "inherit",
          fontSize: 14,
        }}
      />


      

    </section>
  );
}
