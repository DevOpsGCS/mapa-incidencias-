import { describe, expect, it } from "vitest";
import { COLUMN_LABELS, DEFAULT_COLUMNS, loadColumns, saveColumns } from "../src/lib/tableColumns";

describe("loadColumns", () => {
  it("con null devuelve los defaults", () => expect(loadColumns(null)).toEqual(DEFAULT_COLUMNS));
  it("con getItem que lanza devuelve los defaults", () => {
    const storage = {
      getItem: () => {
        throw new Error("denegado");
      },
    };
    expect(loadColumns(storage)).toEqual(DEFAULT_COLUMNS);
  });
  it("con JSON inválido devuelve los defaults", () => {
    expect(loadColumns({ getItem: () => "not json" })).toEqual(DEFAULT_COLUMNS);
  });
  it("sin valor guardado devuelve los defaults", () => {
    expect(loadColumns({ getItem: () => null })).toEqual(DEFAULT_COLUMNS);
  });
  it("lee las columnas guardadas", () => {
    expect(loadColumns({ getItem: () => '["tn","title"]' })).toEqual(["tn", "title"]);
  });
  it("descarta ids desconocidos", () => {
    expect(loadColumns({ getItem: () => '["tn","zzz","title"]' })).toEqual(["tn", "title"]);
  });
  it("usa la clave metrics.columns.v1", () => {
    let key = "";
    loadColumns({ getItem: (k) => ((key = k), null) });
    expect(key).toBe("metrics.columns.v1");
  });
});

describe("saveColumns", () => {
  it("guarda JSON bajo la clave", () => {
    const saved: Record<string, string> = {};
    saveColumns({ setItem: (k, v) => void (saved[k] = v) }, ["tn", "title"]);
    expect(saved["metrics.columns.v1"]).toBe('["tn","title"]');
  });
  it("tolera null y excepciones", () => {
    expect(() => saveColumns(null, ["tn"])).not.toThrow();
    expect(() =>
      saveColumns(
        {
          setItem: () => {
            throw new Error("lleno");
          },
        },
        ["tn"]
      )
    ).not.toThrow();
  });
});

describe("COLUMN_LABELS", () => {
  it("tiene etiqueta para cada default", () => {
    for (const id of DEFAULT_COLUMNS) expect(COLUMN_LABELS[id]).toBeTruthy();
  });
});
