import { Box, Typography } from "@mui/material";
import { observer } from "mobx-react-lite";
import React from "react";
import appStore from "../stores/app-store";

const MainPage = observer(() => {
  return (
    <Box sx={{ p: 2 }}>
      <Typography>User token: {appStore.userToken}</Typography>
    </Box>
  );
});

export default MainPage;
