import { Box, Button, Typography } from "@mui/material";
import { observer } from "mobx-react-lite";
import React from "react";
import appStore from "../stores/app-store";

function getCookieValue(cookieKey) {
  const cookiePrefix = `${cookieKey}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookiePrefix));

  if (!cookie) {
    return "";
  }

  return decodeURIComponent(cookie.slice(cookiePrefix.length));
}

const MainPage = observer(() => {
  const loadTokenFromCookie = () => {
    const token = getCookieValue("bambicloud_user");
    appStore.setUserToken(token || "Cookie not found");
  };

  return (
    <Box
      sx={{ p: 2, minHeight: "100%", display: "flex", flexDirection: "column" }}
    >
      <Box sx={{ flex: 1 }}>
        <Typography>User token: {appStore.userToken.slice(0, 5)}...</Typography>
      </Box>

      <Box
        sx={{
          pt: 2,
          mt: 2,
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          gap: 1,
          justifyContent: "flex-end"
        }}
      >
        <Button variant="contained" onClick={loadTokenFromCookie}>
          Load token from cookie
        </Button>
      </Box>
    </Box>
  );
});

export default MainPage;
