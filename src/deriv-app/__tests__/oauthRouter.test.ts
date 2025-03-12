import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { app } from "@/server";

describe("OAUTH Router", () => {
  describe("Pre Deriv Authentication", () => {
    it("should render a loading bar whilist saving the user tg data in localstorage", async () => {
      // Act
      const response = await request(app).get("/deriv-oauth");

      // Assert
      expect(response.status).toBe(StatusCodes.OK);
      expect(response.text).toContain("Please wait...");
    });
  });
  describe("Post Deriv Authentication", () => {
    it("should render a loading bar whilist saving the user tg data in localstorage", async () => {
      // Act
      const response = await request(app).get("/deriv-callback");

      // Assert
      expect(response.status).toBe(StatusCodes.OK);
      expect(response.text).toContain("Please wait...");
    });
  });
});
