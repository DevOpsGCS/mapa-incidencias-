import { describe, expect, it } from "vitest";
import { pickVisibleLabels } from "../src/lib/labelCollision";

describe("pickVisibleLabels", () => {
  it("muestra todas las etiquetas si no se tocan", () => {
    const visible = pickVisibleLabels([
      { id: "a", x: 100, y: 100, text: "Poy", priority: 0 },
      { id: "b", x: 400, y: 100, text: "Anguiatú", priority: 0 },
    ]);
    expect([...visible].sort()).toEqual(["a", "b"]);
  });

  it("si chocan, conserva la de mayor prioridad", () => {
    const visible = pickVisibleLabels([
      { id: "carga", x: 300, y: 300, text: "Aeropuerto Terminal de Carga", priority: 0 },
      { id: "intl", x: 310, y: 305, text: "Aeropuerto Internacional", priority: 1 },
      { id: "pasajeros", x: 305, y: 295, text: "Aeropuerto Terminal de Pasajeros", priority: 0 },
    ]);
    expect([...visible]).toEqual(["intl"]);
  });

  it("a igual prioridad gana la primera de la lista", () => {
    const visible = pickVisibleLabels([
      { id: "a", x: 300, y: 300, text: "Santa Elena", priority: 0 },
      { id: "b", x: 305, y: 300, text: "San Bartolo", priority: 0 },
    ]);
    expect([...visible]).toEqual(["a"]);
  });

  it("el zoom de TV agranda las etiquetas y puede generar choques nuevos", () => {
    const labels = [
      { id: "a", x: 100, y: 100, text: "Santa Elena", priority: 0 },
      { id: "b", x: 200, y: 100, text: "San Bartolo", priority: 0 },
    ];
    expect(pickVisibleLabels(labels, 1).size).toBe(2);
    expect(pickVisibleLabels(labels, 1.6).size).toBe(1);
  });
});
