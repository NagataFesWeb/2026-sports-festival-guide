import type { NextConfig } from "next";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isProjectPage = repositoryName !== "" && !repositoryName.endsWith(".github.io");

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: isProjectPage ? `/${repositoryName}` : "",
  images: { unoptimized: true },
};

export default nextConfig;
