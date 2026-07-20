/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "community.bohemia.net",
        pathname: "/wikidata/images/**",
      },
    ],
  },
};
export default nextConfig;
