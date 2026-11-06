import { describe, expect, it } from "vitest";
import { describeFileError } from "./file-errors";

describe("describeFileError", () => {
  it("replaces system error codes with a plain reason", () => {
    const error = new Error(
      "Error invoking remote method 'file:save': Error: EPERM: operation not permitted, open 'C:\\a.mmd'"
    );

    expect(describeFileError(error)).toBe("permission was denied, or the file is read-only");
  });

  it("recognizes a code in a plain message from the main process", () => {
    expect(describeFileError("ENOENT: no such file or directory, open 'a.mmd'"))
      .toBe("the file or folder doesn't exist");
  });

  it("strips the remote call wrapper from other messages", () => {
    const error = new Error("Error invoking remote method 'file:open': Error: Something unusual.");

    expect(describeFileError(error)).toBe("Something unusual");
  });

  it("passes through an unknown system code without inventing a reason", () => {
    expect(describeFileError(new Error("EWEIRD: odd failure"))).toBe("EWEIRD: odd failure");
  });
});
