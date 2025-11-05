import React, { useState, useCallback, useEffect } from "react";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";

export default function App() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // 🌓 Toggle dark mode on <html> element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const handleFileUpload = async (file) => {
    setLoading(true);
    let jsonObjects = [];

    try {
      if (file.name.endsWith(".zip")) {
        const zip = await JSZip.loadAsync(file);
        for (const filename of Object.keys(zip.files)) {
          const content = await zip.files[filename].async("string");
          const parsed = JSON.parse(content);
          jsonObjects.push(...(Array.isArray(parsed) ? parsed : [parsed]));
        }
      } else {
        const text = await file.text();
        const parsed = JSON.parse(text);
        jsonObjects = Array.isArray(parsed) ? parsed : [parsed];
      }

      const csvRows = [];
      jsonObjects.forEach((wf) => processWorkflow(wf, csvRows));
      setRows(csvRows);
    } catch (err) {
      console.error("Error reading file:", err);
      alert("Invalid or unreadable file. Please upload a valid JSON/ZIP.");
    } finally {
      setLoading(false);
    }
  };

  const processWorkflow = (wf, csvRows) => {
    if (wf.parameterRequests?.length) {
      wf.parameterRequests.forEach((p) =>
        csvRows.push(makeRow("Create Job Form", p.label, p))
      );
    }

    wf.stageRequests?.forEach((stage) => {
      stage.taskRequests?.forEach((task) => {
        task.parameterRequests?.forEach((param) =>
          csvRows.push(makeRow(stage.name, task.name, param))
        );
      });
    });
  };

  const makeRow = (stage, task, param) => {
    const fieldLogic = {
      SINGLE_SELECT: `Performer selects if ${param.label}.`,
      MULTISELECT: `Performer selects one or more options for ${param.label}.`,
      CHECKLIST: `Performer checks applicable items for ${param.label}.`,
      SINGLE_LINE: `Performer enters ${param.label}.`,
      MULTI_LINE: `Performer enters a detailed response for ${param.label}.`,
      FILE_UPLOAD: `Performer uploads the required file(s) for ${param.label}.`,
      RESOURCE: `Performer selects a resource for ${param.label}.`,
      DATE: `Performer enters the date for ${param.label}.`,
      INSTRUCTION: `Performer provides input for ${param.label}.`,
    };

    const options =
      Array.isArray(param.data)
        ? param.data.map((d) => d.name).join(" • ")
        : Array.isArray(param.data?.choices)
        ? param.data.choices.map((d) => d.name).join(" • ")
        : "";

    const desc =
      fieldLogic[param.type] +
      (options ? ` Available Options: • ${options}` : "");

    const rules = (param.rules || [])
      .map(
        (r) =>
          `Visible if [${param.label}] is [${r.input?.join(", ")}]. Shows parameters: [${r.show?.parameters?.join(", ")}]`
      )
      .join("; ");

    return {
      "Stage Name": stage,
      "Activity Name": task,
      Performer: "Performer/Verifier",
      "Activity Description in detail": desc,
      "Validations / Conditions": rules,
      "Instruction Title": param.label,
      "Field Type": param.mandatory ? "Mandatory" : "Optional",
      "Activity / Parameter Type": param.type,
      "Configuration Feasibility": "Configurable",
      "Configuration Feasibility Notes": "N/A",
      "Configuration Status": "Configured",
      "Verification Status":
        param.verificationType === "SELF" ||
        param.verificationType === "BOTH"
          ? "Enabled"
          : "Disabled",
      "Tester Comments": "N/A",
      "Verification B Status":
        param.verificationType === "BOTH" ? "Enabled" : "Disabled",
      "Tester Comments (B)": "N/A",
    };
  };

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileUpload(file);
    },
    []
  );

  const downloadCSV = () => {
    const csv = Papa.unparse(rows, { delimiter: ";" });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "workflow_extracted.csv");
  };

  const downloadXLSX = () => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Workflow");
    XLSX.writeFile(wb, "workflow_extracted.xlsx");
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
      } p-10`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">
          Workflow JSON → CSV/XLSX Converter
        </h1>

        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`px-4 py-2 rounded-md transition ${
            darkMode
              ? "bg-gray-700 hover:bg-gray-600"
              : "bg-gray-200 hover:bg-gray-300"
          }`}
        >
          {darkMode ? "🌞 Light Mode" : "🌙 Dark Mode"}
        </button>
      </div>

      {/* Upload Zone */}
      <div
        className={`border-4 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center transition ${
          dragActive
            ? "border-blue-600 bg-blue-50 dark:bg-blue-900/30"
            : darkMode
            ? "border-gray-600 bg-gray-800"
            : "border-gray-300 bg-white hover:border-blue-400"
        }`}
      >
        <p className="text-lg mb-2">
          Drag & Drop your JSON or ZIP file here
        </p>
        <p className="text-sm opacity-80 mb-4">or</p>
        <input
          type="file"
          accept=".json,.zip"
          onChange={(e) =>
            e.target.files[0] && handleFileUpload(e.target.files[0])
          }
          className="block text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
        />
      </div>

      {/* Loading */}
      {loading && (
        <p className="text-blue-500 mt-6 font-semibold">Processing file...</p>
      )}

      {/* Data Table */}
      {rows.length > 0 && (
        <div className="mt-8">
          <div className="flex gap-4 mb-4">
            <button
              onClick={downloadCSV}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Download CSV
            </button>
            <button
              onClick={downloadXLSX}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Download XLSX
            </button>
          </div>

          <div
            className={`overflow-auto max-h-[500px] border rounded-md ${
              darkMode ? "border-gray-700" : "border-gray-200"
            }`}
          >
            <table
              className={`min-w-full text-sm text-left ${
                darkMode ? "text-gray-200" : "text-gray-800"
              }`}
            >
              <thead
                className={`sticky top-0 ${
                  darkMode ? "bg-gray-800" : "bg-gray-100"
                }`}
              >
                <tr>
                  {Object.keys(rows[0]).map((key) => (
                    <th key={key} className="px-4 py-2 border-b">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={darkMode ? "odd:bg-gray-800" : "odd:bg-gray-50"}>
                    {Object.values(r).map((val, j) => (
                      <td key={j} className="px-4 py-2 border-b">
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
