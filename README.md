# Compressor Material Assessment — local browser package

This is a static browser app for checking **a selected material** against a recorded project case. The input sheet and figures in the reference image inspired the workflow. They are **example values and an illustrative domain drawing**, not built-in acceptance rules.

## Run locally

1. Unzip the package and open the `compressor-material-assessment-local` folder in VS Code.
2. Start **Live Server** from `index.html`, or open a terminal in the folder and run:

   ```sh
   python -m http.server 8000
   ```

3. Open <http://localhost:8000> in a modern browser. There is no installation or internet dependency. Opening `index.html` directly with `file://` may block JavaScript modules in some browsers; use a local server.

## GitHub Pages and phone use

- Upload the **contents** of the unzipped `compressor-material-assessment-local` folder to the root of your GitHub repository, including `index.html`, `styles.css`, `mobile.css`, and the `.mjs` files. You may leave out `tests/` and `README.md` when publishing.
- In the repository, open **Settings → Pages**, select **Deploy from a branch**, choose your branch and `/ (root)`, then save. Open the resulting Pages URL on your phone.
- On a phone, tap a stage to reveal its input fields. Swipe inside a chart or tap **Expand** to explore it. The calculated-results table can also be scrolled sideways within its panel.
- Browser storage is tied to the site address. A case saved under `localhost` will not automatically appear at the GitHub Pages address or on another device. Export its JSON locally, then import it at the Pages address if you want to move it.

## First run

- The **Assessment** tab starts with six editable example stages and example material names. These material records have blank service limits, so the initial result is **Evidence needed**.
- Enter pressure (absolute bar), temperature, gas mole percentages, aqueous pH where wet, corrosion rate from your own assessment, water status, and sources. Provide the settled-out / standstill (SOP) case, minimum design metal temperature (MDMT), contaminants, service life, and a case design-basis reference.
- In **Material library**, add or edit each component material, actual wetted surface and product form. Enter limits supported by a document and mark the record reviewed only after checking it.
- Document a dry-service H₂S limit if any stages or SOP are dry. Wet-service limits, aqueous pH and assessed corrosion rates apply where liquid water is confirmed.
- Return to **Assessment** and choose the material for each component. Expand **View assessment checks** for breaches, missing evidence, and completed checks.
- The water and SSC charts support hover, click, keyboard selection, and SVG/PNG downloads. The SSC domains D0–D3 describe the **plotted environment only**. They do not certify a grade.
- Save named cases in the browser. **Export case JSON** includes the case and material library for backup or transfer. **Import case JSON** brings both into the current browser. **Export results CSV** provides a tabular summary.

## Decision meanings

| Result | Meaning |
| --- | --- |
| Outside recorded limits | At least one entered exposure or condition exceeds a recorded material limit. |
| Evidence needed | No recorded limit is breached, but information or a reviewed material source is missing. |
| Within recorded limits · conditional | All required inputs for the assessed wet/dry exposure fit the entered and reviewed material limits. Engineering sign-off is still needed. |

The calculation uses ideal gas partial pressures. Water saturation uses a limited Antoine estimate valid for water dew points 0–100 °C. The +10 °C line is a visualization of approach, not a proof that a metal surface is dry. Corrosion rate is **not predicted**: enter independently assessed rates and relevant material loss allowances. Product standards, SSC qualification, fabrication, coatings, phase behavior, mechanical strength, and API 617 / ISO 15156 compliance require separate documented engineering review. A material name alone never passes.

## Local data

Inputs, named cases and material records are stored in `localStorage` for the browser and origin used. Use **Export case JSON** as a backup before clearing browser storage or moving to another computer. No cloud service is used.

## Check calculation tests

If Node.js is installed, run `node tests/engine.test.mjs` from this folder. Tests cover incomplete records, a conditional documented case, limit breaches and missing wet-case evidence. The app itself does not require Node.js.
