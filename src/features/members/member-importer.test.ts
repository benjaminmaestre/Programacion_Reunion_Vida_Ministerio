import { describe, expect, it } from "vitest";
import { OFFICIAL_CONGREGATION_MEMBERS } from "./official-directory-data";
import { previewMemberImport, validateOfficialImportData } from "./member-importer";
import type { DirectoryMember } from "./demo-data";

describe("Importación real del directorio de 125 personas (Congregación Las Violetas)", () => {
  it("valida correctamente la estructura del listado oficial de 125 personas", () => {
    const validation = validateOfficialImportData(OFFICIAL_CONGREGATION_MEMBERS);

    expect(validation.totalRecords).toBe(125);
    expect(validation.eldersCount).toBe(12);
    expect(validation.ministerialServantsCount).toBe(7);
    expect(validation.regularPioneersCount).toBe(22);
    expect(validation.publishersCount).toBe(87);
    expect(validation.isValidStructure).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("conserva los 3 casos exactos de responsabilidades combinadas de nombramiento + precursor regular", () => {
    const combinedPioneers = OFFICIAL_CONGREGATION_MEMBERS.filter(
      (m) => m.appointment !== "none" && m.isRegularPioneer,
    );

    expect(combinedPioneers).toHaveLength(3);
    const names = combinedPioneers.map((m) => `${m.firstName} ${m.lastName}`);
    expect(names).toContain("Widmar Grisales"); // Anciano + PR
    expect(names).toContain("Heriberto Hernández"); // SM + PR
    expect(names).toContain("Yomar Márquez"); // SM + PR
  });

  it("conserva las responsabilidades adicionales específicas como Secretario", () => {
    const secretary = OFFICIAL_CONGREGATION_MEMBERS.find((m) => m.additionalRoles === "secretario");
    expect(secretary).toBeDefined();
    expect(secretary?.firstName).toBe("Luis");
    expect(secretary?.lastName).toBe("Castrillo");
    expect(secretary?.appointment).toBe("elder");
  });

  it("detecta duplicados al previsualizar la importación contra un directorio existente", () => {
    const existingMembers: DirectoryMember[] = [
      {
        id: "ex-1",
        firstName: "Abrahán",
        lastName: "Díaz",
        gender: "male",
        appointment: "elder",
        isActive: true,
        isBaptized: true,
      },
    ];

    const preview = previewMemberImport(existingMembers, OFFICIAL_CONGREGATION_MEMBERS);

    expect(preview.toInsertCount).toBe(124);
    expect(preview.toUpdateCount).toBe(1);
    expect(preview.duplicateRecords[0].existingMember.id).toBe("ex-1");
    expect(preview.duplicateRecords[0].newRecord.firstName).toBe("Abrahán");
  });

  it("no fusiona personas con nombres similares o apellidos compartidos", () => {
    // Verificar que personas como "Gonzalo Adolfo Álvarez" y "Gonzalo Álvarez Ramírez" se mantengan separadas
    const gonzalos = OFFICIAL_CONGREGATION_MEMBERS.filter((m) => m.firstName.startsWith("Gonzalo"));
    expect(gonzalos).toHaveLength(2);
    expect(gonzalos[0].lastName).not.toBe(gonzalos[1].lastName);
  });
});
