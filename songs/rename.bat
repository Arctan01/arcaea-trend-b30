@echo off
setlocal enabledelayedexpansion
for /d %%d in ("dl_*") do (
    set "oldname=%%d"
    set "newname=!oldname:~3!"
    if not exist "!newname!" (
        echo 正在重命名: "!oldname!" → "!newname!"
        ren "!oldname!" "!newname!"
    ) else (
        echo 跳过: "!oldname!" → 目标名称 "!newname!" 已存在
    )
)
echo 操作完成，按任意键退出。
pause