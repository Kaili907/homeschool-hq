// tsx asks Node for a per-user temporary-directory suffix. In this managed
// Windows release environment, uv_os_get_passwd can fail even though the
// process identity is otherwise valid. Supplying a stable non-secret numeric
// identity keeps tsx's cache isolated without reading a personal path.
if (typeof process.geteuid !== "function") {
  process.geteuid = () => 1;
}
