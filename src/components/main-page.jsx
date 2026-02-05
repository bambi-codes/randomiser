import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Slider,
  Switch,
  Typography
} from "@mui/material";
import { observer } from "mobx-react-lite";
import React, { useEffect, useMemo, useState } from "react";
import appStore from "../stores/app-store";
import { toJS } from "mobx";

function tokenPreview(token) {
  if (!token) {
    return "(empty)";
  }

  return `${token.slice(0, 5)}...`;
}

function formatDuration(durationMilliseconds) {
  if (!Number.isFinite(durationMilliseconds) || durationMilliseconds <= 0) {
    return null;
  }

  const totalSeconds = Math.round(durationMilliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = hours > 0 ? String(minutes).padStart(2, "0") : minutes;
  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
}

const MainPage = observer(() => {
  const [playlistPendingDeleteUuid, setPlaylistPendingDeleteUuid] =
    useState("");
  const [targetMinutes, setTargetMinutes] = useState(60);

  useEffect(() => {
    void appStore.hydrateFromStorage();
  }, []);

  const pendingDeletePlaylist = useMemo(() => {
    if (!playlistPendingDeleteUuid) {
      return null;
    }

    return appStore.savedPlaylistsByUuid[playlistPendingDeleteUuid] || null;
  }, [playlistPendingDeleteUuid, appStore.savedPlaylistsByUuid]);

  const handleConfirmPlaylistDelete = () => {
    if (playlistPendingDeleteUuid) {
      appStore.removePlaylist(playlistPendingDeleteUuid);
    }
    setPlaylistPendingDeleteUuid("");
  };

  return (
    <Box
      sx={{
        p: 2,
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        zIndex: 10
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
        <Typography>User token: {tokenPreview(appStore.userToken)}</Typography>
        <Typography>Saved playlists: {appStore.savedPlaylistCount}</Typography>

        <Box
          sx={{
            mt: 1,
            p: 2,
            borderRadius: 2,
            border: "1px solid #e5e7eb",
            display: "flex",
            flexDirection: "column",
            gap: 1
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              flexWrap: "wrap"
            }}
          >
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <Typography color="text.secondary">
                Playlist length (minutes): {targetMinutes}
              </Typography>
              <Slider
                min={30}
                max={120}
                step={1}
                value={targetMinutes}
                valueLabelDisplay="auto"
                onChange={(_event, value) => {
                  if (typeof value === "number") {
                    setTargetMinutes(value);
                    appStore.clearPlaylistCreateStatus();
                  }
                }}
              />
            </Box>
            <Button
              variant="contained"
              onClick={() =>
                void appStore.createRandomizedPlaylist(targetMinutes)
              }
              disabled={appStore.isCreatingPlaylist}
            >
              {appStore.isCreatingPlaylist ? "Creating..." : "Create playlist"}
            </Button>
          </Box>

          {appStore.playlistCreateError && (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                border: "1px solid #fecaca",
                backgroundColor: "#fee2e2"
              }}
            >
              <Typography color="error">
                {appStore.playlistCreateError}
              </Typography>
            </Box>
          )}

          {appStore.playlistCreateSuccess && (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                border: "1px solid #86efac",
                backgroundColor: "#dcfce7"
              }}
            >
              <Typography color="success.main">
                {appStore.playlistCreateSuccess}
              </Typography>
            </Box>
          )}
        </Box>

        {appStore.isLoadingPlaylist && (
          <Typography>Loading playlist...</Typography>
        )}

        {appStore.playlistLoadError && (
          <Typography color="error">{appStore.playlistLoadError}</Typography>
        )}

        {appStore.savedPlaylistCount === 0 && (
          <Typography sx={{ mt: 1 }}>No playlists loaded yet.</Typography>
        )}

        {appStore.savedPlaylists.map((playlist) => (
          <Accordion key={playlist.uuid} sx={{ mt: 1 }}>
            <AccordionSummary>
              <Box
                sx={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 2
                }}
              >
                <Typography>{playlist.name}</Typography>
                <Box sx={{ display: "flex", gap: 2 }}>
                  {playlist.isHfo && (
                    <Typography color="text.secondary">
                      HFO: {Math.round((playlist.hfoValue ?? 0.5) * 100)}%
                    </Typography>
                  )}
                  <Typography color="text.secondary">
                    Tracks: {playlist.tracks.length}
                  </Typography>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 1
                  }}
                >
                  <Button
                    color="error"
                    variant="outlined"
                    onClick={() => setPlaylistPendingDeleteUuid(playlist.uuid)}
                  >
                    Remove playlist
                  </Button>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(playlist.isInduction)}
                          onChange={(_event, checked) => {
                            appStore.setPlaylistTypeFlags(playlist.uuid, {
                              isInduction: checked,
                              isAwakener: false,
                              isHfo: false
                            });
                          }}
                        />
                      }
                      label="Induction"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(playlist.isAwakener)}
                          onChange={(_event, checked) => {
                            appStore.setPlaylistTypeFlags(playlist.uuid, {
                              isInduction: false,
                              isAwakener: checked,
                              isHfo: false
                            });
                          }}
                        />
                      }
                      label="Awakener"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(playlist.isHfo)}
                          onChange={(_event, checked) => {
                            appStore.setPlaylistTypeFlags(playlist.uuid, {
                              isInduction: false,
                              isAwakener: false,
                              isHfo: checked
                            });
                          }}
                        />
                      }
                      label="HFO"
                    />
                  </Box>
                </Box>

                {playlist.isHfo && (
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    <Typography color="text.secondary">
                      HFO percentage inclusion:{" "}
                      {Math.round((playlist.hfoValue ?? 0.5) * 100)}%
                    </Typography>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={playlist.hfoValue ?? 0.5}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) =>
                        `${Math.round(value * 100)}%`
                      }
                      onChangeCommitted={(_event, value) => {
                        if (typeof value === "number") {
                          appStore.setPlaylistHfoValue(playlist.uuid, value);
                        }
                      }}
                    />
                  </Box>
                )}

                {playlist.tracks.map((track) => (
                  <Box
                    key={track.uuid}
                    sx={{ display: "flex", flexDirection: "column" }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 2
                      }}
                    >
                      <Typography>{track.name}</Typography>
                      <Typography color="text.secondary">
                        {formatDuration(track.durationMilliseconds) ??
                          "Unknown duration"}{" "}
                        ·{" "}
                        {track.fileAuthor?.trim()
                          ? track.fileAuthor.trim()
                          : "unknown author"}{" "}
                        · {track.weight}
                      </Typography>
                    </Box>
                    <Slider
                      min={1}
                      max={20}
                      step={1}
                      value={track.weight}
                      valueLabelDisplay="auto"
                      onChangeCommitted={(_event, value) => {
                        if (typeof value === "number") {
                          appStore.updateTrackWeight(
                            playlist.uuid,
                            track.uuid,
                            value
                          );
                        }
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>

      <Dialog
        open={Boolean(pendingDeletePlaylist)}
        onClose={() => setPlaylistPendingDeleteUuid("")}
        disablePortal
        sx={{ zIndex: 1000001 }}
      >
        <DialogTitle>Remove playlist?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Remove "{pendingDeletePlaylist?.name}" and all its saved track
            weights from this extension?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlaylistPendingDeleteUuid("")}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmPlaylistDelete}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>

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
        <Button
          variant="outlined"
          onClick={() => {
            console.log(toJS(appStore));
          }}
        >
          log store
        </Button>
        <Button variant="outlined" onClick={() => appStore.resetUserToken()}>
          Reset token
        </Button>
        <Button
          variant="outlined"
          onClick={() => appStore.loadUserTokenFromCookie()}
        >
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
