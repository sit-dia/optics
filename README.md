# VR Optics Explorer

An interactive thin-lens optics simulator for VR/AR education. Built for the Design for Immersive Applications (DIA) module at the Singapore Institute of Technology.

[![Live Demo](https://img.shields.io/badge/Live_Demo-optics.diaversity.org-blue?style=for-the-badge&logo=googlechrome&logoColor=white)](https://optics.diaversity.org)

## Features

- **Interactive thin-lens simulation** with real-time ray tracing of three principal rays
- **Two optical regimes** visualized: HMD mode (virtual image, d_o < f) and Projector mode (real image, d_o > f)
- **Adjustable parameters** via sliders for focal length and lens-to-display distance
- **Color-coded edge glow indicators** that signal when the image extends beyond the viewport (purple for virtual, green for real)
- **Automatic label placement** with collision avoidance and leader lines for displaced labels
- **Device outlines** showing HMD or projector housing depending on the regime
- **Live readouts** for image distance, magnification, and current regime
- **On-canvas equation display** showing the thin-lens equation with current values
- **Backward ray extensions** (dashed) for virtual image formation

## Quick Start

Visit the live demo: **[optics.diaversity.org](https://optics.diaversity.org)**

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/sit-dia/optics.git
   cd optics
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:5173/` (or the URL shown in the terminal).

### Build for Production

```bash
npm run build
```

This compiles TypeScript and outputs the production build to the `docs/` directory (for GitHub Pages deployment).

### Run Tests

```bash
npm test
```

## Things to Try

- Move the **Lens-to-Display Distance** slider below the focal length to enter HMD mode, and observe how the virtual image forms on the same side as the object.
- Set the distance equal to the focal length and watch the image go to infinity.
- Move the distance just slightly above the focal length to see a very distant real image, indicated by a green glow on the right edge.
- Adjust the **Focal Length** slider and notice how the lens shape changes to reflect different curvatures.

## Tech Stack

- **TypeScript** with strict mode
- **Canvas 2D** for all rendering (no external rendering libraries)
- **Vite** for build tooling and dev server
- **Vitest** for unit testing
- **GitHub Pages** for hosting

## Project Structure

```
src/
  main.ts           # Entry point
  canvas-utils.ts   # Drawing primitives (arrows, lens, rays, labels, glow)
  optics-math.ts    # Thin-lens equation, magnification, image type
  constants.ts      # Colors, default HMD parameters
  types.ts          # TypeScript type definitions
  ui-controls.ts    # Slider and readout UI components
  panels/
    thin-lens.ts    # Main thin-lens simulation panel
```

## Related Projects

- **[HMD Simulator](https://hmd.diaversity.org)** ([repo](https://github.com/sit-dia/hmd)): A 3D VR headset simulator covering stereo rendering, frustum visualization, and lens distortion.

## Contributing

Contributions are welcome! Whether you are improving documentation, adding new optical panels, or fixing bugs, your input is valuable.

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes with clear, descriptive commits
4. Push to your fork and open a Pull Request
5. Request review

### Guidelines

- Write clear commit messages describing what changed and why
- Update documentation if you are changing functionality
- Test your changes locally before submitting
- Follow existing code style (TypeScript strict mode, 2-space indentation, no tabs)

## License

MIT
