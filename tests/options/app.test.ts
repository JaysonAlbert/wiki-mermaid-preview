import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor, within } from "@testing-library/dom"
import { defaultRules } from "../../src/shared/default-rules"
import { refreshRegisteredContentScripts } from "../../src/shared/content-script-registration"
import { mountOptionsApp } from "../../src/options/app"

vi.mock("../../src/shared/content-script-registration", () => ({
  refreshRegisteredContentScripts: vi.fn().mockResolvedValue(undefined)
}))

afterEach(() => {
  document.body.innerHTML = ""
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.mocked(refreshRegisteredContentScripts).mockReset()
})

describe("mountOptionsApp", () => {
  it("adds a valid site pattern, stores it, and refreshes registrations", async () => {
    const request = vi.fn().mockResolvedValue(true)
    const remove = vi.fn().mockResolvedValue(true)
    const set = vi.fn().mockResolvedValue(undefined)

    vi.stubGlobal("chrome", {
      permissions: {
        request,
        remove
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            selectorRules: defaultRules,
            siteAccessPatterns: []
          }),
          set
        }
      }
    })

    const root = document.createElement("div")
    document.body.append(root)

    await mountOptionsApp(root)

    fireEvent.input(screen.getByLabelText("Site match pattern"), {
      target: { value: "http://example.com/*" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Allow Site" }))

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith({
        origins: ["http://example.com/*"]
      })
    })

    expect(set).toHaveBeenCalledWith({
      siteAccessPatterns: [
        expect.objectContaining({
          pattern: "http://example.com/*"
        })
      ]
    })
    await waitFor(() => {
      expect(refreshRegisteredContentScripts).toHaveBeenCalledWith([
        "http://example.com/*"
      ])
    })
    await waitFor(() => {
      expect(screen.getByText("http://example.com/*")).toBeTruthy()
    })
  })

  it("prevents duplicate add clicks while site access is pending", async () => {
    let resolveRequest!: (value: boolean) => void
    const request = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRequest = resolve
        })
    )
    const remove = vi.fn().mockResolvedValue(true)
    const set = vi.fn().mockResolvedValue(undefined)

    vi.stubGlobal("chrome", {
      permissions: {
        request,
        remove
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            selectorRules: defaultRules,
            siteAccessPatterns: []
          }),
          set
        }
      }
    })

    const root = document.createElement("div")
    document.body.append(root)

    await mountOptionsApp(root)

    fireEvent.input(screen.getByLabelText("Site match pattern"), {
      target: { value: "http://example.com/*" }
    })

    const allowButton = screen.getByRole("button", { name: "Allow Site" })
    fireEvent.click(allowButton)

    expect((screen.getByRole("button", { name: "Allow Site" }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: "Allow Site" }))

    expect(request).toHaveBeenCalledTimes(1)

    resolveRequest(true)

    await waitFor(() => {
      expect(set).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(refreshRegisteredContentScripts).toHaveBeenCalledWith([
        "http://example.com/*"
      ])
    })
  })

  it("rolls back site access when saving the pattern fails", async () => {
    const request = vi.fn().mockResolvedValue(true)
    const remove = vi.fn().mockResolvedValue(true)
    const set = vi.fn().mockRejectedValueOnce(new Error("storage unavailable"))
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    vi.stubGlobal("chrome", {
      permissions: {
        request,
        remove
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            selectorRules: defaultRules,
            siteAccessPatterns: []
          }),
          set
        }
      }
    })

    const root = document.createElement("div")
    document.body.append(root)

    await mountOptionsApp(root)

    fireEvent.input(screen.getByLabelText("Site match pattern"), {
      target: { value: "http://example.com/*" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Allow Site" }))

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith({
        origins: ["http://example.com/*"]
      })
    })

    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith({
        origins: ["http://example.com/*"]
      })
    })

    expect(consoleError).toHaveBeenCalledWith(
      "[wiki-mermaid-preview]",
      expect.any(Error)
    )
    expect(refreshRegisteredContentScripts).not.toHaveBeenCalled()
    expect(screen.getByText("Could not save site access.")).toBeTruthy()
    expect(screen.queryByText("http://example.com/*")).toBeNull()
  })

  it("reports refresh failures after saving site access", async () => {
    const request = vi.fn().mockResolvedValue(true)
    const remove = vi.fn().mockResolvedValue(true)
    const set = vi.fn().mockResolvedValue(undefined)
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(refreshRegisteredContentScripts).mockRejectedValueOnce(
      new Error("refresh failed")
    )

    vi.stubGlobal("chrome", {
      permissions: {
        request,
        remove
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            selectorRules: defaultRules,
            siteAccessPatterns: []
          }),
          set
        }
      }
    })

    const root = document.createElement("div")
    document.body.append(root)

    await mountOptionsApp(root)

    fireEvent.input(screen.getByLabelText("Site match pattern"), {
      target: { value: "http://example.com/*" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Allow Site" }))

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith({
        origins: ["http://example.com/*"]
      })
    })

    await waitFor(() => {
      expect(set).toHaveBeenCalledWith({
        siteAccessPatterns: [
          expect.objectContaining({ pattern: "http://example.com/*" })
        ]
      })
    })

    await waitFor(() => {
      expect(screen.getByText("Site access was saved, but registration refresh failed.")).toBeTruthy()
    })
    expect(consoleError).toHaveBeenCalledWith(
      "[wiki-mermaid-preview]",
      expect.any(Error)
    )
    expect(screen.getByText("http://example.com/*")).toBeTruthy()
  })

  it("rejects duplicate site patterns", async () => {
    const request = vi.fn().mockResolvedValue(true)
    const remove = vi.fn().mockResolvedValue(true)
    const set = vi.fn().mockResolvedValue(undefined)

    vi.stubGlobal("chrome", {
      permissions: {
        request,
        remove
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            selectorRules: defaultRules,
            siteAccessPatterns: [
              { id: "site-1", pattern: "http://example.com/*" }
            ]
          }),
          set
        }
      }
    })

    const root = document.createElement("div")
    document.body.append(root)

    await mountOptionsApp(root)

    fireEvent.input(screen.getByLabelText("Site match pattern"), {
      target: { value: "http://example.com/*" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Allow Site" }))

    await waitFor(() => {
      expect(screen.getByText("That site match pattern is already allowed.")).toBeTruthy()
    })
    expect(request).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
    expect(refreshRegisteredContentScripts).not.toHaveBeenCalled()
  })

  it("reports a failed site access removal", async () => {
    const request = vi.fn().mockResolvedValue(true)
    const remove = vi.fn().mockRejectedValueOnce(new Error("remove failed"))
    const set = vi.fn().mockResolvedValue(undefined)
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    vi.stubGlobal("chrome", {
      permissions: {
        request,
        remove
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            selectorRules: defaultRules,
            siteAccessPatterns: [
              { id: "site-1", pattern: "http://example.com/*" }
            ]
          }),
          set
        }
      }
    })

    const root = document.createElement("div")
    document.body.append(root)

    await mountOptionsApp(root)

    fireEvent.click(screen.getByRole("button", { name: "Remove" }))

    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith({
        origins: ["http://example.com/*"]
      })
    })

    expect(set).not.toHaveBeenCalled()
    expect(refreshRegisteredContentScripts).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(
      "[wiki-mermaid-preview]",
      expect.any(Error)
    )
    expect(screen.getByText("Could not update site access.")).toBeTruthy()
    expect(screen.getByText("http://example.com/*")).toBeTruthy()
  })

  it("removes an authorized site pattern and refreshes registrations", async () => {
    const request = vi.fn().mockResolvedValue(true)
    const remove = vi.fn().mockResolvedValue(true)
    const set = vi.fn().mockResolvedValue(undefined)

    vi.stubGlobal("chrome", {
      permissions: {
        request,
        remove
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            selectorRules: defaultRules,
            siteAccessPatterns: [
              { id: "site-1", pattern: "http://example.com/*" }
            ]
          }),
          set
        }
      }
    })

    const root = document.createElement("div")
    document.body.append(root)

    await mountOptionsApp(root)

    fireEvent.click(screen.getByRole("button", { name: "Remove" }))

    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith({
        origins: ["http://example.com/*"]
      })
    })

    await waitFor(() => {
      expect(set).toHaveBeenCalledWith({
        siteAccessPatterns: []
      })
    })

    await waitFor(() => {
      expect(refreshRegisteredContentScripts).toHaveBeenCalledWith([])
    })

    expect(screen.queryByText("http://example.com/*")).toBeNull()
  })

  it("debounces text edits and persists the latest value", async () => {
    vi.useFakeTimers()

    const set = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("chrome", {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ selectorRules: defaultRules }),
          set
        }
      }
    })

    const root = document.createElement("div")
    document.body.append(root)

    await mountOptionsApp(root)

    expect(screen.getByRole("heading", { name: "Wiki Mermaid Preview" })).toBeTruthy()
    expect(screen.getByDisplayValue("Confluence line-by-line Mermaid")).toBeTruthy()
    expect(screen.getByDisplayValue("Code tag Mermaid block")).toBeTruthy()

    const firstCard = screen.getByTestId("rule-card-confluence-line-by-line")
    const nameInput = within(firstCard).getByLabelText("Rule name")
    fireEvent.input(nameInput, { target: { value: "Updated name 1" } })
    fireEvent.input(nameInput, { target: { value: "Updated name 2" } })

    expect(within(firstCard).getByRole("heading", { name: "Updated name 2" })).toBeTruthy()

    await vi.advanceTimersByTimeAsync(250)

    expect(set).toHaveBeenCalledTimes(1)
    expect(set).toHaveBeenCalledWith({
      selectorRules: expect.arrayContaining([
        expect.objectContaining({ name: "Updated name 2" })
      ])
    })
  })

  it("logs autosave failures without breaking the editor", async () => {
    vi.useFakeTimers()

    const error = new Error("storage unavailable")
    const set = vi.fn().mockRejectedValueOnce(error)
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    vi.stubGlobal("chrome", {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ selectorRules: defaultRules }),
          set
        }
      }
    })

    const root = document.createElement("div")
    document.body.append(root)

    await mountOptionsApp(root)

    const firstCard = screen.getByTestId("rule-card-confluence-line-by-line")
    const nameInput = within(firstCard).getByLabelText("Rule name")
    fireEvent.input(nameInput, { target: { value: "Updated name" } })

    await vi.advanceTimersByTimeAsync(250)

    expect(set).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith("[wiki-mermaid-preview]", error)
  })

  it("persists checkbox toggles once with the final state", async () => {
    const set = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("chrome", {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({}),
          set
        }
      }
    })

    const root = document.createElement("div")
    document.body.append(root)

    await mountOptionsApp(root)

    const firstCard = screen.getByTestId("rule-card-confluence-line-by-line")
    const enabledCheckbox = within(firstCard).getByLabelText("Enabled")

    fireEvent.input(enabledCheckbox, { target: { checked: false } })
    fireEvent.change(enabledCheckbox, { target: { checked: false } })

    expect(set).toHaveBeenCalledTimes(1)
    expect(set).toHaveBeenCalledWith({
      selectorRules: expect.arrayContaining([
        expect.objectContaining({ enabled: false })
      ])
    })
  })

  it("keeps reset ahead of stale in-flight saves and renders defaults immediately", async () => {
    vi.useFakeTimers()

    let resolveFirstWrite!: () => void
    let resolveSecondWrite!: () => void
    const firstWrite = new Promise<void>((resolve) => {
      resolveFirstWrite = resolve
    })
    const secondWrite = new Promise<void>((resolve) => {
      resolveSecondWrite = resolve
    })
    const set = vi
      .fn()
      .mockImplementationOnce(() => firstWrite)
      .mockImplementationOnce(() => secondWrite)

    vi.stubGlobal("chrome", {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ selectorRules: defaultRules }),
          set
        }
      }
    })

    const root = document.createElement("div")
    document.body.append(root)

    await mountOptionsApp(root)

    const firstCard = screen.getByTestId("rule-card-confluence-line-by-line")
    const nameInput = within(firstCard).getByLabelText("Rule name")
    fireEvent.input(nameInput, { target: { value: "Edited name" } })

    await vi.advanceTimersByTimeAsync(250)
    expect(set).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole("button", { name: "Reset Defaults" }))
    expect(screen.getByDisplayValue("Confluence line-by-line Mermaid")).toBeTruthy()
    expect(set).toHaveBeenCalledTimes(1)

    resolveFirstWrite()
    await firstWrite
    await Promise.resolve()

    expect(set).toHaveBeenCalledTimes(2)
    expect(set.mock.calls[1][0]).toEqual({ selectorRules: defaultRules })

    resolveSecondWrite()
  })

  it("adds new rules in a disabled state", async () => {
    const set = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("chrome", {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({}),
          set
        }
      }
    })

    const root = document.createElement("div")
    document.body.append(root)

    await mountOptionsApp(root)

    fireEvent.click(screen.getByRole("button", { name: "Add Rule" }))

    const enabledCheckboxes = screen.getAllByLabelText("Enabled")
    const addedRuleEnabled = enabledCheckboxes[enabledCheckboxes.length - 1] as HTMLInputElement
    expect(addedRuleEnabled.checked).toBe(false)
    expect(screen.getAllByDisplayValue("*://*/*").length).toBe(3)

    expect(set).toHaveBeenCalledWith({
      selectorRules: expect.arrayContaining([
        expect.objectContaining({ enabled: false, urlPatterns: ["*://*/*"] })
      ])
    })
  })

  it("can delete and reset rules", async () => {
    const set = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("chrome", {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({}),
          set
        }
      }
    })

    const root = document.createElement("div")
    document.body.append(root)

    await mountOptionsApp(root)

    fireEvent.click(screen.getByRole("button", { name: "Add Rule" }))
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0])
    expect(set).toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Reset Defaults" }))
    await Promise.resolve()
    await Promise.resolve()

    expect(set).toHaveBeenCalledTimes(2)
    expect(set.mock.calls[1][0]).toEqual({ selectorRules: defaultRules })
  })
})
