import time

from aiohttp import web
import os
import json
import folder_paths
import server # Import server for node_info
import uuid # For generating unique filenames
import aiohttp

HIDDEN_FOLDERS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".hidden_folders")

def read_hidden_folders():
    if not os.path.exists(HIDDEN_FOLDERS_FILE):
        return []
    with open(HIDDEN_FOLDERS_FILE, 'r') as f:
        return [line.strip() for line in f.readlines()]

def write_hidden_folders(hidden_folders):
    with open(HIDDEN_FOLDERS_FILE, 'w') as f:
        f.write('\n'.join(hidden_folders))


async def get_hello(request: web.Request) -> web.Response:
    return web.json_response({"status": "success", "message": "Hello from the CozyGen API!"})

async def toggle_folder_visibility(request: web.Request) -> web.Response:
    data = await request.json()
    folder_to_toggle = data.get('folder')

    if not folder_to_toggle:
        return web.json_response({"error": "Missing 'folder' in request body"}, status=400)

    hidden_folders = read_hidden_folders()

    if folder_to_toggle in hidden_folders:
        hidden_folders.remove(folder_to_toggle)
    else:
        hidden_folders.append(folder_to_toggle)

    write_hidden_folders(hidden_folders)

    return web.json_response({"status": "success", "hidden_folders": hidden_folders})

async def get_gallery_files(request: web.Request) -> web.Response:
    subfolder = request.rel_url.query.get('subfolder', '')
    show_hidden_str = request.rel_url.query.get('show_hidden', 'false')
    show_hidden = show_hidden_str.lower() == 'true'

    try:
        page = int(request.rel_url.query.get('page', '1'))
        per_page = int(request.rel_url.query.get('per_page', '20'))
    except ValueError:
        return web.json_response({"error": "Invalid page or per_page parameter"}, status=400)

    output_directory = folder_paths.get_output_directory()
    hidden_folders = read_hidden_folders()

    # Security: Prevent directory traversal
    gallery_path = os.path.normpath(os.path.join(output_directory, subfolder))
    if not gallery_path.startswith(output_directory):
        return web.json_response({"error": "Unauthorized path"}, status=403)

    if not os.path.exists(gallery_path) or not os.path.isdir(gallery_path):
        return web.json_response({"error": "Gallery directory not found"}, status=404)

    items = os.listdir(gallery_path)
    gallery_items = []

    for item_name in items:
        item_path = os.path.join(gallery_path, item_name)
        relative_item_path = os.path.join(subfolder, item_name)

        if not show_hidden and relative_item_path in hidden_folders:
            continue

        if os.path.isdir(item_path):
            mod_time = os.path.getmtime(item_path)
            gallery_items.append({
                "filename": item_name,
                "type": "directory",
                "subfolder": os.path.join(subfolder, item_name),
                "mod_time": mod_time,
                "hidden": relative_item_path in hidden_folders
            })
        elif item_name.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.webm', '.mp3', '.wav', '.flac')):
            mod_time = os.path.getmtime(item_path)
            gallery_items.append({
                "filename": item_name,
                "type": "output",
                "subfolder": subfolder,
                "mod_time": mod_time
            })

    # Sort items: directories first, then by modification time
    gallery_items.sort(key=lambda x: (x['type'] == 'directory', x.get('mod_time', 0)), reverse=True)

    # Pagination
    total_items = len(gallery_items)
    total_pages = (total_items + per_page - 1) // per_page
    start_index = (page - 1) * per_page
    end_index = start_index + per_page
    paginated_items = gallery_items[start_index:end_index]

    # Remove mod_time before sending
    for item in paginated_items:
        if 'mod_time' in item:
            del item['mod_time']

    return web.json_response({
        "items": paginated_items,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
        "total_items": total_items
    })

async def upload_image(request: web.Request) -> web.Response:
    reader = await request.multipart()
    field = await reader.next()

    if field.name != 'image':
        return web.json_response({"error": "Expected field 'image'"}, status=400)

    filename = field.filename
    if not filename:
        return web.json_response({"error": "No filename provided"}, status=400)

    # Generate a unique filename to prevent collisions
    unique_filename = f"{uuid.uuid4()}_{filename}"

    # Save to the input directory of ComfyUI
    input_dir = folder_paths.get_input_directory()
    save_path = os.path.join(input_dir, unique_filename)

    size = 0
    with open(save_path, 'wb') as f:
        while True:
            chunk = await field.read_chunk()
            if not chunk:
                break
            f.write(chunk)
            size += len(chunk)

    return web.json_response({"filename": unique_filename, "size": size})

async def get_workflow_list(request: web.Request) -> web.Response:
    workflows_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "workflows")
    if not os.path.exists(workflows_dir):
        return web.json_response({"error": "Workflows directory not found"}, status=404)

    workflow_files = [f for f in os.listdir(workflows_dir) if f.endswith('.json')]
    return web.json_response({"workflows": workflow_files})

async def get_workflow_file(request: web.Request) -> web.Response:
    filename = request.match_info.get('filename', '')
    workflows_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "workflows")
    workflow_path = os.path.join(workflows_dir, filename)

    if not os.path.exists(workflow_path):
        return web.json_response({"error": f"Workflow file '{filename}' not found"}, status=404)

    try:
        with open(workflow_path, 'r', encoding='utf-8') as f:
            workflow_content = json.load(f)
        return web.json_response(workflow_content)
    except json.JSONDecodeError:
        return web.json_response({"error": f"Invalid JSON in workflow file '{filename}'"}, status=400)
    except Exception:
        return web.json_response({"error": f"Error reading workflow file: {filename}"}, status=500)

import comfy.samplers

# Get all valid model folder types from ComfyUI itself
valid_model_types = folder_paths.folder_names_and_paths.keys()

# A map for aliases to official folder_paths names
alias_map = {
    "unet": "unet_gguf"
}

async def get_choices(request: web.Request) -> web.Response:
    choice_type = request.rel_url.query.get('type', '')

    if not choice_type:
        return web.json_response({"error": "Missing 'type' query parameter"}, status=400)

    # Alias map for backward compatibility
    alias_map = {
        "samplers_list": "sampler",
        "schedulers_list": "scheduler",
        "unet": "unet_gguf" # Example of another potential alias
    }
    resolved_choice_type = alias_map.get(choice_type, choice_type)

    choices = []
    if resolved_choice_type == "scheduler":
        choices = comfy.samplers.KSampler.SCHEDULERS
    elif resolved_choice_type == "sampler":
        choices = comfy.samplers.KSampler.SAMPLERS
    elif resolved_choice_type in valid_model_types:
        choices = folder_paths.get_filename_list(resolved_choice_type)
    else:
        return web.json_response({"error": f"Invalid choice type: {choice_type}"}, status=400)

    return web.json_response({"choices": choices})

import asyncio
from collections import deque

# Global queue to hold generation jobs
# Each job is a dict: {'id': str, 'status': str, 'data': dict, 'workflowName': str}
server_queue = deque()
queue_lock = asyncio.Lock()

async def submit_to_queue(request: web.Request) -> web.Response:
    """Adds a new workflow generation job to the server-side queue."""
    try:
        payload = await request.json()
        prompt = payload.get('prompt')
        workflow_name = payload.get('workflowName', 'Unknown')

        if not prompt:
            return web.json_response({"error": "Missing 'prompt' in request body"}, status=400)

        job_id = str(uuid.uuid4())
        job = {
            "id": job_id,
            "status": "queued",
            "data": prompt,
            "workflowName": workflow_name,
            "timestamp": time.time(),
            "thumbnailUrl": None, # Will be populated on completion
            "comfy_prompt_id": None, # Will be populated by the worker
        }

        async with queue_lock:
            server_queue.append(job)

        return web.json_response({"status": "success", "job_id": job_id})
    except json.JSONDecodeError:
        return web.json_response({"error": "Invalid JSON in request body"}, status=400)
    except Exception:
        return web.json_response({"error": "An internal server error occurred"}, status=500)

async def get_queue_status(request: web.Request) -> web.Response:
    """Returns the current state of the generation queue."""
    async with queue_lock:
        # Simple pruning: if queue is long, trim oldest completed
        while len(server_queue) > 50:
            try:
                oldest_completed = next(j for j in server_queue if j['status'] in ['completed', 'error'])
                server_queue.remove(oldest_completed)
            except StopIteration:
                break # No completed jobs to prune

        queue_list = sorted(list(server_queue), key=lambda j: j.get('timestamp', 0), reverse=True)
    return web.json_response({"queue": queue_list})

async def queue_worker():
    """The background worker that processes the server-side queue."""
    prompt_url = "http://127.0.0.1:8188/prompt"

    async with aiohttp.ClientSession() as session:
        while True:
            job_to_run = None
            async with queue_lock:
                queued_job = next((job for job in server_queue if job['status'] == 'queued'), None)
                if queued_job:
                    queued_job['status'] = 'running'
                    job_to_run = queued_job

            if job_to_run:
                try:
                    job_id = job_to_run['id']
                    prompt = job_to_run['data']

                    # Dynamically inject the job_id into the workflow
                    output_node_id = None
                    for node_id, node_data in prompt.items():
                        if node_data["class_type"] in ["CozyGenOutput", "CozyGenVideoOutput"]:
                            output_node_id = node_id
                            break

                    if output_node_id:
                        # Find a unique ID for our new node
                        job_id_node_id = str(max([int(k) for k in prompt.keys() if k.isdigit()] + [0]) + 1)

                        # Add the new CozyGenJobID node
                        prompt[job_id_node_id] = {
                            "inputs": {"job_id": job_id},
                            "class_type": "CozyGenJobID",
                        }

                        # Link the output node to our new job_id node
                        prompt[output_node_id]["inputs"]["job_id"] = [job_id_node_id, 0]

                    # Prepare the payload for the /prompt endpoint (no longer needs extra_data)
                    payload = {"prompt": prompt}

                    async with session.post(prompt_url, json=payload) as response:
                        if response.status == 200:
                            response_data = await response.json()
                            comfy_prompt_id = response_data.get('prompt_id')
                            async with queue_lock:
                                job_to_run['comfy_prompt_id'] = comfy_prompt_id
                        else:
                            async with queue_lock:
                                job_to_run['status'] = 'queued'

                except Exception:
                    async with queue_lock:
                        job_to_run['status'] = 'queued'

            await asyncio.sleep(1)

async def cozygen_startup(app):
    """Starts the CozyGen background worker on server startup."""
    asyncio.create_task(queue_worker())


async def get_presets(request: web.Request) -> web.Response:
    workflow_name = request.rel_url.query.get('workflow', '')
    if not workflow_name:
        return web.json_response({"error": "Missing 'workflow' query parameter"}, status=400)

    presets_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "presets")
    workflow_presets_dir = os.path.join(presets_dir, os.path.splitext(workflow_name)[0])

    if not os.path.exists(workflow_presets_dir):
        return web.json_response({"presets": []})

    preset_files = [f for f in os.listdir(workflow_presets_dir) if f.endswith('.json')]
    return web.json_response({"presets": preset_files})

async def get_preset_file(request: web.Request) -> web.Response:
    workflow_name = request.match_info.get('workflow_name', '')
    preset_name = request.match_info.get('preset_name', '')
    
    presets_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "presets")
    preset_path = os.path.join(presets_dir, os.path.splitext(workflow_name)[0], preset_name)

    if not os.path.exists(preset_path):
        return web.json_response({"error": f"Preset file '{preset_name}' not found"}, status=404)

    try:
        with open(preset_path, 'r', encoding='utf-8') as f:
            preset_content = json.load(f)
        return web.json_response(preset_content)
    except Exception as e:
        return web.json_response({"error": f"Error reading preset file: {e}"}, status=500)

async def save_preset(request: web.Request) -> web.Response:
    data = await request.json()
    workflow_name = data.get('workflow')
    preset_name = data.get('preset_name')
    form_data = data.get('form_data')

    if not all([workflow_name, preset_name, form_data]):
        return web.json_response({"error": "Missing required fields"}, status=400)

    presets_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "presets")
    workflow_presets_dir = os.path.join(presets_dir, os.path.splitext(workflow_name)[0])
    os.makedirs(workflow_presets_dir, exist_ok=True)

    preset_path = os.path.join(workflow_presets_dir, f"{preset_name}.json")

    try:
        with open(preset_path, 'w', encoding='utf-8') as f:
            json.dump(form_data, f, indent=4)
        return web.json_response({"status": "success"})
    except Exception as e:
        return web.json_response({"error": f"Error saving preset file: {e}"}, status=500)

async def delete_preset(request: web.Request) -> web.Response:
    data = await request.json()
    workflow_name = data.get('workflow')
    preset_name = data.get('preset_name')

    if not all([workflow_name, preset_name]):
        return web.json_response({"error": "Missing required fields"}, status=400)

    presets_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "presets")
    preset_path = os.path.join(presets_dir, os.path.splitext(workflow_name)[0], preset_name)

    if not os.path.exists(preset_path):
        return web.json_response({"error": "Preset not found"}, status=404)

    try:
        os.remove(preset_path)
        return web.json_response({"status": "success"})
    except Exception as e:
        return web.json_response({"error": f"Error deleting preset: {e}"}, status=500)

routes = [
    web.get('/cozygen/hello', get_hello),
    web.get('/cozygen/gallery', get_gallery_files),
    web.post('/cozygen/toggle_folder_visibility', toggle_folder_visibility),
    web.post('/cozygen/upload_image', upload_image),
    web.get('/cozygen/workflows', get_workflow_list),
    web.get('/cozygen/workflows/{filename}', get_workflow_file),
    web.get('/cozygen/get_choices', get_choices),
    web.post('/cozygen/submit', submit_to_queue),
    web.get('/cozygen/queue', get_queue_status),
    web.get('/cozygen/presets', get_presets),
    web.get('/cozygen/presets/{workflow_name}/{preset_name}', get_preset_file),
    web.post('/cozygen/presets', save_preset),
    web.delete('/cozygen/presets', delete_preset),
]

# Register the startup function correctly
server.PromptServer.instance.app.on_startup.append(cozygen_startup)
