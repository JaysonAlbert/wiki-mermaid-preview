import "./style.css"
import { mountOptionsApp } from "./app"

const root = document.getElementById("app")

if (!root) {
  throw new Error("Options root not found")
}

void mountOptionsApp(root)
