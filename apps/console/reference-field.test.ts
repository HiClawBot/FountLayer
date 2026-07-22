import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReferenceField } from "./components/reference-field";

describe("ReferenceField", () => {
  it("renders a required choice when existing records are available", () => {
    const html = renderToStaticMarkup(
      createElement(ReferenceField, {
        emptyLabel: "Select an app",
        id: "channel-app-id",
        label: "App ID",
        name: "appId",
        options: [
          { label: "Paper Reader · app_pdf_reader", value: "app_pdf_reader" },
        ],
        placeholder: "app_example",
      }),
    );

    expect(html).toContain('aria-describedby="channel-app-id-help"');
    expect(html).toContain('id="channel-app-id"');
    expect(html).toContain('name="appId"');
    expect(html).toContain('required=""');
    expect(html).toContain('<option value="app_pdf_reader">');
    expect(html).toContain("Paper Reader · app_pdf_reader");
    expect(html).not.toContain("placeholder=");
  });

  it("falls back to a required text input when no records exist", () => {
    const html = renderToStaticMarkup(
      createElement(ReferenceField, {
        emptyLabel: "Select an app",
        id: "route-app-id",
        label: "App ID",
        name: "appId",
        options: [],
        placeholder: "app_example",
      }),
    );

    expect(html).toContain('placeholder="app_example"');
    expect(html).toContain('aria-describedby="route-app-id-help"');
    expect(html).toContain('id="route-app-id"');
    expect(html).toContain('name="appId"');
    expect(html).toContain('required=""');
    expect(html).toContain("enter the ID manually");
    expect(html).not.toContain("<select");
  });
});
