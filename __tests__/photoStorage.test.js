const mockDeleted = [];
let mockFiles = [];
jest.mock("expo-file-system", () => {
  class Directory {
    constructor() { this.exists = true; }
    list() { return mockFiles; }
    create() {}
  }
  class File {}
  return { Directory, File, Paths: { document: "file:///doc" } };
});

const { pruneUnusedPhotos, deleteAllPhotos } = require("../src/utils/photoStorage");

const file = (name) => ({ uri: `file:///doc/cooksnap-scans/${name}`, delete: () => mockDeleted.push(name) });

beforeEach(() => {
  mockDeleted.length = 0;
  mockFiles = [file("scan-1.jpg"), file("scan-2.jpg"), file("scan-3.jpg"), file("notes.txt")];
});

describe("scan photo cleanup", () => {
  it("deletes only the scan photos nothing refers to", () => {
    const removed = pruneUnusedPhotos(["file:///doc/cooksnap-scans/scan-2.jpg", null, "asset:/sample.jpg"]);
    expect(removed).toBe(2);
    expect(mockDeleted.sort()).toEqual(["scan-1.jpg", "scan-3.jpg"]);
  });

  it("never touches files that are not scan photos", () => {
    pruneUnusedPhotos([]);
    expect(mockDeleted).not.toContain("notes.txt");
  });

  it("deleteAllPhotos removes every scan photo", () => {
    expect(deleteAllPhotos()).toBe(3);
  });

  it("keeps going and does not throw when one file cannot be deleted", () => {
    mockFiles[0].delete = () => { throw new Error("busy"); };
    expect(() => pruneUnusedPhotos([])).not.toThrow();
    expect(mockDeleted.sort()).toEqual(["scan-2.jpg", "scan-3.jpg"]);
  });
});
