# Waimin-branded production server image.
# Thin overlay on the upstream Twenty server image — replaces logo, page title,
# auth-screen strings, and Lingui catalog entries with Waimin branding.
#
# Built and pushed by .github/workflows/waimin-build-server.yaml on every push to waimin.

ARG UPSTREAM_TAG=latest
FROM twentycrm/twenty:${UPSTREAM_TAG}

# 1. Overlay branded logo
COPY packages/twenty-front/public/images/waimin-logo.png /app/packages/twenty-server/dist/front/images/waimin-logo.png

# 2. Overlay branded index.html (title + OG meta tags)
COPY packages/twenty-front/index.html /app/packages/twenty-server/dist/front/index.html

# 3. Patch English strings baked into the compiled JS bundle
#    These are sourced from packages/twenty-front/src/{pages/auth,modules/auth/sign-in-up/components}/
RUN find /app/packages/twenty-server/dist/front/assets -name "*.js" -exec sed -i \
      -e 's/Welcome to Twenty/Welcome to Waimin/g' \
      -e 's/By using Twenty/By using Waimin/g' \
      -e 's|/images/twenty-logo\.svg|/images/waimin-logo.png|g' \
      -e 's|/images/twenty-logo-dark\.svg|/images/waimin-logo.png|g' \
      {} +

# Same patch for Lingui-translated catalogs (en, fallback to source)
RUN find /app/packages/twenty-server/dist/front/assets -name "en-*.js" -exec sed -i \
      -e 's/Welcome to Twenty/Welcome to Waimin/g' \
      -e 's/By using Twenty/By using Waimin/g' \
      {} +
