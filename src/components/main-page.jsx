import { Box, Button, Typography } from "@mui/material";
import { observer } from "mobx-react-lite";
import React, { useEffect } from "react";
import appStore from "../stores/app-store";

function tokenPreview(token) {
  if (!token) {
    return "(empty)";
  }

  return `${token.slice(0, 5)}...`;
}

const MainPage = observer(() => {
  useEffect(() => {
    void appStore.hydrateFromStorage();
  }, []);

  const activePlaylist = appStore.activePlaylist;

  return (
    <Box sx={{ p: 2, minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
        <Typography>User token: {tokenPreview(appStore.userToken)}</Typography>
        <Typography>Saved playlists: {appStore.savedPlaylistCount}</Typography>

        {appStore.isLoadingPlaylist && (
          <Typography>Loading playlist...</Typography>
        )}

        {appStore.playlistLoadError && (
          <Typography color="error">{appStore.playlistLoadError}</Typography>
        )}

        {activePlaylist && (
          <Box sx={{ mt: 1 }}>
            <Typography>Active playlist: {activePlaylist.name}</Typography>
            <Typography>UUID: {activePlaylist.uuid}</Typography>
            <Typography>Tracks: {activePlaylist.tracks.length}</Typography>
          </Box>
        )}
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
        <Button variant="outlined" onClick={() => appStore.resetUserToken()}>
          Reset token
        </Button>
        <Button variant="outlined" onClick={() => appStore.loadUserTokenFromCookie()}>
          Load token from cookie
        </Button>
        <Button
          variant="contained"
          onClick={() => void appStore.loadPlaylistFromCurrentUrl()}
          disabled={appStore.isLoadingPlaylist}
        >
          Load playlist
        </Button>
      </Box>
    </Box>
  );
});

export default MainPage;
